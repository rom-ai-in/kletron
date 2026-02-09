export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";
import { agentGraphRunService } from "@numezis/server/services/agentGraphRunService";
import { SafeEditGate } from "@numezis/server/services/agent/SafeEditGate";
import { McpClient } from "@numezis/mcp-client/client";

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
  const relativeDir = path.join(".numezis", "agent-cache", "approvals", runId);
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

  const run = await agentGraphRunService.getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const editId = typeof body?.editId === "string" ? body.editId : "";
  const action = typeof body?.action === "string" ? body.action : "";

  const executeEdit = async (edit: any) => {
    const toolName = String(edit.toolName ?? "");
    if (!["write_file", "execute_bash", "str_replace_editor"].includes(toolName)) {
      return { executed: false, message: "Unsupported tool" };
    }
    const client = await McpClient.getInstance();
    const resolvedArgs = resolveArgs(toolName, edit.args ?? {}, workspace.rootPath);
    const raw = await client.callTool(toolName, resolvedArgs as any);
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

      const granted = Array.isArray(run.state?.approvals?.granted) ? [...run.state.approvals.granted as any[]] : [];
      for (const edit of edits) {
        let executionResult: any;
        try { executionResult = await executeEdit(edit); } catch (err) {
          executionResult = { executed: false, message: (err as Error)?.message ?? "Execution failed" };
        }
        granted.push({
          id: edit.id, toolName: edit.toolName, args: edit.args,
          status: "approved", executedAt: new Date().toISOString(),
          result: executionResult.result ?? executionResult.message ?? "",
          evictedPath: executionResult.evictedPath ?? undefined,
        });
      }
      const approvals = await updateRunApprovals({ pending: [], granted });
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
      ? (run.state.approvals.pending as any[]).filter((p: any) => p?.id !== editId) : [];
    const granted = Array.isArray(run.state?.approvals?.granted) ? [...run.state.approvals.granted as any[]] : [];
    granted.push({
      id: edit.id, toolName: edit.toolName, args: edit.args,
      status: "approved", executedAt: new Date().toISOString(),
      result: executionResult.result ?? executionResult.message ?? "",
      evictedPath: executionResult.evictedPath ?? undefined,
    });
    const approvals = await updateRunApprovals({ pending, granted });
    return NextResponse.json({ approved: edit, executionResult, approvals });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Approval failed" }, { status: 500 });
  }
}
