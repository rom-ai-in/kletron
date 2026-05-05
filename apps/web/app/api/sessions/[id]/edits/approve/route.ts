export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { SafeEditGate } from "@kletron/server/services/agent/SafeEditGate";
import { McpClient } from "@kletron/mcp-client/client";
import {
    invokeKletronAdminToolForApproval,
    isKletronAdminToolName,
} from "@kletron/server/services/kletronAdminToolApprovalRunner";
import { syncWorkspaceExternalMcpServers } from "@kletron/server/services/mcpWorkspaceSync";
import {
    invokeWriteFileApprovalFallback,
    invokeStrReplaceEditorApprovalFallback,
    isMcpBundledToolNotFoundError,
} from "@kletron/server/services/bundledToolApprovalFallback";

const safeEditGate = SafeEditGate.getInstance();

const EVICT_CHARS = Number.isFinite(Number.parseInt(process.env.TOOL_RESULT_EVICT_CHARS ?? "", 10))
  ? Number.parseInt(process.env.TOOL_RESULT_EVICT_CHARS ?? "", 10)
  : 80000;
const PREVIEW_CHARS = Number.isFinite(Number.parseInt(process.env.TOOL_RESULT_PREVIEW_CHARS ?? "", 10))
  ? Number.parseInt(process.env.TOOL_RESULT_PREVIEW_CHARS ?? "", 10)
  : 2000;

const stringifyResult = (raw: unknown) => {
  if (typeof raw === "string") return raw;
  if (raw === undefined || raw === null) return "";
  try { return JSON.stringify(raw, null, 2); } catch { return String(raw); }
};

const resolveArgs = (toolName: string, args: Record<string, any>, rootDir: string) => {
  const resolved = { ...(args ?? {}) };
  const resolveIfRelative = (key: string) => {
    const val = resolved[key];
    if (typeof val === "string" && !path.isAbsolute(val)) {
      resolved[key] = path.resolve(rootDir, val);
    } else if ((val === undefined || val === null) && key === "path") {
      resolved[key] = rootDir;
    }
  };
  resolveIfRelative("path");
  resolveIfRelative("filePath");
  resolveIfRelative("repoPath");
  if (toolName === "write_file" && !resolved.repoPath) resolved.repoPath = rootDir;
  if (toolName === "execute_bash" && !resolved.path) resolved.path = rootDir;
  return resolved;
};

async function maybeEvictResult(rootDir: string, runId: string, toolName: string, raw: unknown) {
  const content = stringifyResult(raw);
  if (!content || content.length <= EVICT_CHARS) return { content, evictedPath: null };
  const relativeDir = path.join(".kletron", "agent-cache", "approvals", runId);
  const dir = path.join(rootDir, relativeDir);
  await mkdir(dir, { recursive: true });
  const safeTool = toolName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${safeTool}-${randomUUID()}.txt`;
  const relativePath = path.join(relativeDir, fileName);
  await writeFile(path.join(rootDir, relativePath), content, "utf8");
  const preview = content.slice(0, PREVIEW_CHARS);
  return {
    content: [`Result evicted to ${relativePath}`, `Preview (first ${PREVIEW_CHARS} chars):`, preview].join("\n"),
    evictedPath: relativePath,
  };
}

/**
 * Fire-and-forget: resume the agent loop after a successful tool approval.
 * The LLM receives a synthetic user message describing what was executed and
 * the result, then continues its reasoning.
 */
async function resumeAgentAfterApproval(
  runId: string,
  executionSummaries: Array<{ toolName: string; result?: string; evictedPath?: string }>,
  userId?: string,
) {
  try {
    const run = await agentGraphRunService.getRun(runId);
    if (!run) return;
    if (run.status === "RUNNING") {
      console.log(`[edits/approve] Run ${runId} still RUNNING, skipping resume`);
      return;
    }

    const parts = executionSummaries.map((s) => {
      const resultSnippet = s.evictedPath
        ? `Result evicted to file ${s.evictedPath}`
        : (s.result ?? "OK").slice(0, 2000);
      return `Tool \`${s.toolName}\` was approved and executed successfully.\nResult:\n${resultSnippet}`;
    });
    const message = parts.join("\n\n---\n\n") + "\n\nPlease continue with the task.";

    const { agentGraphExecutor } = await import("@kletron/server/services/agentGraphExecutor");
    console.log(`[edits/approve] Resuming agent after approval for run ${runId}`);
    await agentGraphExecutor.continueRun(runId, message, {
      ...(userId ? { workspaceContextUserId: userId } : {}),
    });
    console.log(`[edits/approve] ✓ Agent resumed successfully for run ${runId}`);
  } catch (err) {
    console.error(`[edits/approve] ✗ Failed to resume agent after approval for ${runId}:`, (err as Error)?.message);
  }
}

/**
 * POST /api/sessions/[id]/edits/approve - Approve edit(s).
 * Body: { editId: string } or { action: "all" }
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const workspaceIdStr = workspace._id.toString();

  const run = await agentGraphRunService.getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const editId = typeof body?.editId === "string" ? body.editId : "";
  const action = typeof body?.action === "string" ? body.action : "";

  const executeEdit = async (edit: any) => {
    const toolName = String(edit.toolName ?? "");
    if (isKletronAdminToolName(toolName)) {
      const raw = await invokeKletronAdminToolForApproval({
        toolName,
        args: (edit.args ?? {}) as Record<string, unknown>,
        workspace,
        userId: auth.userId,
        runId: params.id,
      });
      const evicted = await maybeEvictResult(workspace.rootPath, params.id, toolName, raw);
      return { executed: true, result: evicted.content, evictedPath: evicted.evictedPath ?? undefined };
    }
    // All other tools (read-only MCP, edits, bash, etc.) replay through the same MCP client as the agent.
    const client = await McpClient.getInstance();
    await syncWorkspaceExternalMcpServers(workspaceIdStr);
    const resolvedArgs = resolveArgs(toolName, edit.args ?? {}, workspace.rootPath);
    let raw: string;
    try {
      raw = await client.callTool(toolName, resolvedArgs as any, {
        workspaceId: workspaceIdStr,
      });
    } catch (mcpErr) {
      if (toolName === "write_file" && isMcpBundledToolNotFoundError(mcpErr)) {
        raw = await invokeWriteFileApprovalFallback(workspace.rootPath, resolvedArgs);
      } else if (toolName === "str_replace_editor" && isMcpBundledToolNotFoundError(mcpErr)) {
        raw = await invokeStrReplaceEditorApprovalFallback(workspace.rootPath, resolvedArgs);
      } else {
        throw mcpErr;
      }
    }
    const evicted = await maybeEvictResult(workspace.rootPath, params.id, toolName, raw);
    return { executed: true, result: evicted.content, evictedPath: evicted.evictedPath ?? undefined };
  };

  const updateRunApprovals = async (update: Record<string, any>) => {
    const latestRun = await agentGraphRunService.getRun(params.id);
    if (!latestRun) throw new Error("Run not found");
    const state = latestRun.state ?? {} as any;
    const approvals = (state as any).approvals ?? {};
    (state as any).approvals = {
      pending: update.pending ?? approvals.pending ?? [],
      granted: update.granted ?? approvals.granted ?? [],
      rejected: update.rejected ?? approvals.rejected ?? [],
    };
    await agentGraphRunService.updateRunState(params.id, state as any);
    return (state as any).approvals;
  };

  try {
    if (action === "all") {
      // Approve all pending edits
      const pendingFromGate = safeEditGate.listPendingEdits(params.id);
      const pendingFromState = Array.isArray(run.state?.approvals?.pending) ? run.state.approvals.pending : [];
      const seen = new Set<string>();
      const edits = [...pendingFromGate, ...pendingFromState as any[]].filter((item: any) => {
        const id = String(item?.id ?? "");
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).map((edit: any) => {
        const gateEdit = safeEditGate.getPendingEdit(edit.id);
        return gateEdit ? safeEditGate.approveEdit(edit.id) : edit;
      });

      const pending = Array.isArray(run.state?.approvals?.pending) ? [...run.state.approvals.pending as any[]] : [];
      const granted = Array.isArray(run.state?.approvals?.granted) ? [...run.state.approvals.granted as any[]] : [];
      const executionSummaries: Array<{ toolName: string; result?: string; evictedPath?: string }> = [];

      for (const edit of edits) {
        let executionResult: any;
        try { executionResult = await executeEdit(edit); } catch (err) {
          executionResult = { executed: false, message: (err as Error)?.message ?? "Execution failed" };
        }
        const idx = pending.findIndex((p: any) => p?.id === edit.id);
        if (executionResult?.executed) {
          if (idx >= 0) pending.splice(idx, 1);
          granted.push({
            id: edit.id, toolName: edit.toolName, args: edit.args,
            status: "approved", executedAt: new Date().toISOString(),
            result: executionResult.result ?? executionResult.message ?? "",
            evictedPath: executionResult.evictedPath ?? undefined,
          });
          executionSummaries.push({
            toolName: edit.toolName,
            result: executionResult.result,
            evictedPath: executionResult.evictedPath,
          });
        } else if (idx >= 0) {
          pending[idx] = {
            ...pending[idx],
            status: "pending",
            lastError: executionResult?.message ?? "Execution failed",
            lastAttemptAt: new Date().toISOString(),
          };
        }
      }
      const approvals = await updateRunApprovals({ pending, granted });

      // Fire-and-forget: resume the agent loop
      if (executionSummaries.length > 0) {
        void resumeAgentAfterApproval(params.id, executionSummaries, auth.userId);
      }

      return NextResponse.json({ approved: edits, approvals });
    }

    // Single edit approval
    if (!editId) {
      return NextResponse.json({ error: "editId is required" }, { status: 400 });
    }
    const existing = safeEditGate.getPendingEdit(editId);
    const pendingFromState = Array.isArray(run.state?.approvals?.pending) ? run.state.approvals.pending : [];
    const fallback = (pendingFromState as any[]).find((p: any) => p?.id === editId);
    if (!existing && !fallback) {
      return NextResponse.json({ error: "Edit not found" }, { status: 404 });
    }
    const edit = existing ? safeEditGate.approveEdit(editId) : fallback;
    let executionResult: any;
    try { executionResult = await executeEdit(edit); } catch (err) {
      executionResult = { executed: false, message: (err as Error)?.message ?? "Execution failed" };
    }

    const pending = Array.isArray(run.state?.approvals?.pending)
      ? [...(run.state.approvals.pending as any[])] : [];
    const granted = Array.isArray(run.state?.approvals?.granted) ? [...run.state.approvals.granted as any[]] : [];
    const pendingIdx = pending.findIndex((p: any) => p?.id === editId);
    if (executionResult?.executed) {
      if (pendingIdx >= 0) pending.splice(pendingIdx, 1);
      granted.push({
        id: edit.id, toolName: edit.toolName, args: edit.args,
        status: "approved", executedAt: new Date().toISOString(),
        result: executionResult.result ?? executionResult.message ?? "",
        evictedPath: executionResult.evictedPath ?? undefined,
      });
    } else if (pendingIdx >= 0) {
      pending[pendingIdx] = {
        ...pending[pendingIdx],
        status: "pending",
        lastError: executionResult?.message ?? "Execution failed",
        lastAttemptAt: new Date().toISOString(),
      };
    }
    const approvals = await updateRunApprovals({ pending, granted });

    // Fire-and-forget: resume the agent loop
    if (executionResult?.executed) {
      void resumeAgentAfterApproval(params.id, [{
        toolName: edit.toolName,
        result: executionResult.result,
        evictedPath: executionResult.evictedPath,
      }], auth.userId);
    }

    return NextResponse.json({ approved: executionResult?.executed ? edit : null, executionResult, approvals }, {
      status: executionResult?.executed ? 200 : 502,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Approval failed" }, { status: 500 });
  }
}
