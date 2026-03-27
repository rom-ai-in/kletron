export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { SafeEditGate } from "@kletron/server/services/agent/SafeEditGate";
import { McpClient } from "@kletron/mcp-client/client";

/**
 * Fire-and-forget: resume the agent loop after a successful tool approval.
 */
async function resumeAgentAfterApproval(
    runId: string,
    executionSummaries: Array<{ toolName: string; result?: string; evictedPath?: string }>
) {
    try {
        const run = await agentGraphRunService.getRun(runId);
        if (!run) return;
        if (run.status === "RUNNING") {
            console.log(`[approvals] Run ${runId} still RUNNING, skipping resume`);
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
        console.log(`[approvals] Resuming agent after approval for run ${runId}`);
        await agentGraphExecutor.continueRun(runId, message, {});
        console.log(`[approvals] ✓ Agent resumed successfully for run ${runId}`);
    } catch (err) {
        console.error(`[approvals] ✗ Failed to resume agent after approval for ${runId}:`, (err as Error)?.message);
    }
}

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
    try {
        return JSON.stringify(raw, null, 2);
    } catch {
        return String(raw);
    }
};

const resolveArgs = (toolName: string, args: Record<string, any>, rootDir: string) => {
    const resolved = { ...(args ?? {}) };
    const resolveIfRelative = (key: string) => {
        const val = resolved[key];
        if (typeof val === "string") {
            if (!path.isAbsolute(val)) {
                resolved[key] = path.resolve(rootDir, val);
            }
        } else if ((val === undefined || val === null) && key === "path") {
            resolved[key] = rootDir;
        }
    };
    resolveIfRelative("path");
    resolveIfRelative("filePath");
    resolveIfRelative("repoPath");
    if (toolName === "write_file" && !resolved.repoPath) {
        resolved.repoPath = rootDir;
    }
    if (toolName === "execute_bash" && !resolved.path) {
        resolved.path = rootDir;
    }
    return resolved;
};

async function maybeEvictResult(rootDir: string, runId: string, toolName: string, raw: unknown) {
    const content = stringifyResult(raw);
    if (!content || content.length <= EVICT_CHARS) {
        return { content, evictedPath: null };
    }
    const relativeDir = path.join(".kletron", "agent-cache", "approvals", runId);
    const dir = path.join(rootDir, relativeDir);
    await mkdir(dir, { recursive: true });
    const safeTool = toolName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${safeTool}-${randomUUID()}.txt`;
    const relativePath = path.join(relativeDir, fileName);
    await writeFile(path.join(rootDir, relativePath), content, "utf8");
    const preview = content.slice(0, PREVIEW_CHARS);
    return {
        content: [
            `Result evicted to ${relativePath}`,
            `Preview (first ${PREVIEW_CHARS} chars):`,
            preview,
        ].join("\n"),
        evictedPath: relativePath,
    };
}

export async function GET(req: NextRequest, { params }: { params: { runId: string } }) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
    if (!workspace || !workspace._id) {
        return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }

    const run = await agentGraphRunService.getRun(params.runId);
    if (!run || run.workspaceId?.toString() !== workspace._id.toString()) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const pendingFromGate = safeEditGate.listPendingEdits(params.runId);
    const pendingFromState = Array.isArray(run?.state?.approvals?.pending)
        ? (run.state.approvals.pending ?? [])
        : [];
    const seen = new Set<string>();
    const merged = [...pendingFromGate, ...pendingFromState].filter((item: any) => {
        const id = String(item?.id ?? "");
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
    return NextResponse.json({ pending: merged }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: { params: { runId: string } }) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
    if (!workspace || !workspace._id) {
        return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }

    const run = await agentGraphRunService.getRun(params.runId);
    if (!run || run.workspaceId?.toString() !== workspace._id.toString()) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    const id = typeof body?.id === "string" ? body.id : "";

    const updateRunApprovals = async (update: {
        pending?: Array<Record<string, unknown>>;
        granted?: Array<Record<string, unknown>>;
        rejected?: Array<Record<string, unknown>>;
    }) => {
        const latestRun = await agentGraphRunService.getRun(params.runId);
        if (!latestRun) throw new Error("Run not found");
        const state = latestRun.state ?? {};
        const approvals = (state as any).approvals ?? {};
        (state as any).approvals = {
            pending: update.pending ?? approvals.pending ?? [],
            granted: update.granted ?? approvals.granted ?? [],
            rejected: update.rejected ?? approvals.rejected ?? [],
        };
        await agentGraphRunService.updateRunState(params.runId, state as any);
        return (state as any).approvals;
    };

    const getPendingFromState = async () => {
        const latestRun = await agentGraphRunService.getRun(params.runId);
        if (!latestRun) throw new Error("Run not found");
        return Array.isArray((latestRun.state as any)?.approvals?.pending)
            ? (((latestRun.state as any).approvals?.pending) ?? [])
            : [];
    };

    const mergePending = (gate: any[], state: any[]) => {
        const seen = new Set<string>();
        const merged: any[] = [];
        for (const item of [...gate, ...state]) {
            const id = String(item?.id ?? "");
            if (!id || seen.has(id)) continue;
            seen.add(id);
            merged.push(item);
        }
        return merged;
    };

    const executeEdit = async (edit: any) => {
        const toolName = String(edit.toolName ?? "");
        if (!["write_file", "execute_bash", "str_replace_editor"].includes(toolName)) {
            return { executed: false, message: "Unsupported tool" };
        }
        const client = await McpClient.getInstance();
        const resolvedArgs = resolveArgs(toolName, edit.args ?? {}, workspace.rootPath);
        const raw = await client.callTool(toolName, resolvedArgs as any);
        const evicted = await maybeEvictResult(workspace.rootPath, params.runId, toolName, raw);
        return { executed: true, result: evicted.content, evictedPath: evicted.evictedPath ?? undefined };
    };

    try {
        if (action === "approve" && id) {
            const existing = safeEditGate.getPendingEdit(id);
            const pendingFromState = await getPendingFromState();
            const fallback = pendingFromState.find((p: any) => p?.id === id);
            if (!existing && !fallback) {
                return NextResponse.json({ error: "Approval not found" }, { status: 404 });
            }
            const edit = existing ? safeEditGate.approveEdit(id) : fallback;
            let executionResult: { executed: boolean; result?: string; evictedPath?: string; message?: string };
            try {
                executionResult = await executeEdit(edit);
            } catch (err) {
                executionResult = { executed: false, message: (err as Error)?.message ?? "Execution failed" };
            }
            const run = await agentGraphRunService.getRun(params.runId);
            const pending = Array.isArray(run?.state?.approvals?.pending)
                ? [...(run?.state?.approvals?.pending ?? [])]
                : [];
            const granted = Array.isArray(run?.state?.approvals?.granted)
                ? (run?.state?.approvals?.granted ?? [])
                : [];
            const pendingIdx = pending.findIndex((p: any) => p?.id === id);
            if (executionResult?.executed) {
                if (pendingIdx >= 0) pending.splice(pendingIdx, 1);
                granted.push({
                    id: edit.id,
                    toolName: edit.toolName,
                    args: edit.args,
                    status: "approved",
                    executedAt: new Date().toISOString(),
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
                void resumeAgentAfterApproval(params.runId, [{
                    toolName: edit.toolName,
                    result: executionResult.result,
                    evictedPath: executionResult.evictedPath,
                }]);
            }

            return NextResponse.json({ approved: executionResult?.executed ? edit : null, executionResult, approvals }, {
                status: executionResult?.executed ? 200 : 502,
            });
        }
        if (action === "reject" && id) {
            const existing = safeEditGate.getPendingEdit(id);
            const pendingFromState = await getPendingFromState();
            const fallback = pendingFromState.find((p: any) => p?.id === id);
            if (!existing && !fallback) {
                return NextResponse.json({ error: "Approval not found" }, { status: 404 });
            }
            const edit = existing ? safeEditGate.rejectEdit(id) : fallback;
            const run = await agentGraphRunService.getRun(params.runId);
            const pending = Array.isArray(run?.state?.approvals?.pending)
                ? (run?.state?.approvals?.pending ?? []).filter((p: any) => p?.id !== id)
                : [];
            const rejected = Array.isArray(run?.state?.approvals?.rejected)
                ? (run?.state?.approvals?.rejected ?? [])
                : [];
            rejected.push({
                id: edit.id,
                toolName: edit.toolName,
                args: edit.args,
                status: "rejected",
                rejectedAt: new Date().toISOString(),
            });
            const approvals = await updateRunApprovals({ pending, rejected });
            return NextResponse.json({ rejected: edit, approvals }, { status: 200 });
        }
        if (action === "approve_all") {
            const pendingFromState = await getPendingFromState();
            const edits = mergePending(safeEditGate.listPendingEdits(params.runId), pendingFromState).map((edit) => {
                const gateEdit = safeEditGate.getPendingEdit(edit.id);
                return gateEdit ? safeEditGate.approveEdit(edit.id) : edit;
            });
            const run = await agentGraphRunService.getRun(params.runId);
            const pending = Array.isArray(run?.state?.approvals?.pending) ? [...(run?.state?.approvals?.pending ?? [])] : [];
            const granted = Array.isArray(run?.state?.approvals?.granted) ? [...(run?.state?.approvals?.granted ?? [])] : [];
            for (const edit of edits) {
                const targetId = edit.id;
                const index = pending.findIndex((p: any) => p?.id === targetId);
                let executionResult: { executed: boolean; result?: string; evictedPath?: string; message?: string };
                try {
                    executionResult = await executeEdit(edit);
                } catch (err) {
                    executionResult = { executed: false, message: (err as Error)?.message ?? "Execution failed" };
                }
                if (executionResult?.executed) {
                    if (index >= 0) pending.splice(index, 1);
                    granted.push({
                        id: edit.id,
                        toolName: edit.toolName,
                        args: edit.args,
                        status: "approved",
                        executedAt: new Date().toISOString(),
                        result: executionResult.result ?? executionResult.message ?? "",
                        evictedPath: executionResult.evictedPath ?? undefined,
                    });
                } else if (index >= 0) {
                    pending[index] = {
                        ...pending[index],
                        status: "pending",
                        lastError: executionResult?.message ?? "Execution failed",
                        lastAttemptAt: new Date().toISOString(),
                    };
                }
            }
            const approvals = await updateRunApprovals({ pending, granted });

            // Fire-and-forget: resume the agent loop
            const executedEdits = edits.filter((e: any) => granted.some((g: any) => g.id === e.id));
            if (executedEdits.length > 0) {
                void resumeAgentAfterApproval(params.runId, executedEdits.map((e: any) => {
                    const g = granted.find((g: any) => g.id === e.id) as any;
                    return { toolName: String(e.toolName), result: String(g?.result ?? ""), evictedPath: g?.evictedPath as string | undefined };
                }));
            }

            return NextResponse.json({ approved: edits, approvals }, { status: 200 });
        }
        if (action === "reject_all") {
            const pendingFromState = await getPendingFromState();
            const edits = mergePending(safeEditGate.listPendingEdits(params.runId), pendingFromState).map((edit) => {
                const gateEdit = safeEditGate.getPendingEdit(edit.id);
                return gateEdit ? safeEditGate.rejectEdit(edit.id) : edit;
            });
            const run = await agentGraphRunService.getRun(params.runId);
            const pending = Array.isArray(run?.state?.approvals?.pending) ? [...(run?.state?.approvals?.pending ?? [])] : [];
            const rejected = Array.isArray(run?.state?.approvals?.rejected) ? [...(run?.state?.approvals?.rejected ?? [])] : [];
            for (const edit of edits) {
                const targetId = edit.id;
                const index = pending.findIndex((p: any) => p?.id === targetId);
                if (index >= 0) pending.splice(index, 1);
                rejected.push({
                    id: edit.id,
                    toolName: edit.toolName,
                    args: edit.args,
                    status: "rejected",
                    rejectedAt: new Date().toISOString(),
                });
            }
            const approvals = await updateRunApprovals({ pending, rejected });
            return NextResponse.json({ rejected: edits, approvals }, { status: 200 });
        }
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error)?.message ?? "Approval failed" }, { status: 500 });
    }
}
