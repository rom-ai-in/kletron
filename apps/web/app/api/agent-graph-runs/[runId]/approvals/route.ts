export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import type { AgentEvent } from "@kletron/shared/types";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { SafeEditGate } from "@kletron/server/services/agent/SafeEditGate";
import { McpClient } from "@kletron/mcp-client/client";
import {
    invokeKletronAdminToolForApproval,
    isKletronAdminToolName,
} from "@kletron/server/services/kletronAdminToolApprovalRunner";
import { syncWorkspaceExternalMcpServers } from "@kletron/server/services/mcpWorkspaceSync";
import { resolveApprovedToolArgs } from "@kletron/server/services/approvedToolArgs";

/**
 * Fire-and-forget: resume the agent loop after a successful tool approval.
 */
async function resumeAgentAfterApproval(
    runId: string,
    executionSummaries: Array<{
        id: string;
        toolName: string;
        args?: Record<string, unknown>;
        result?: string;
        evictedPath?: string;
        isError?: boolean;
    }>,
    userId?: string,
) {
    try {
        const run = await agentGraphRunService.getRun(runId);
        if (!run) return;
        if (run.status === "RUNNING") {
            console.log(`[approvals] Run ${runId} still RUNNING, skipping resume`);
            return;
        }
        const historyEvents: AgentEvent[] = executionSummaries.flatMap((s) => {
            const now = new Date().toISOString();
            const resultSnippet = s.evictedPath
                ? `Result evicted to file ${s.evictedPath}`
                : (s.result ?? "OK").slice(0, 2000);
            return [
                {
                    id: `event-approval-tool-call-${s.id}`,
                    phaseId: "approval",
                    phaseLabel: "Approved tool call",
                    kind: "assistant",
                    role: "assistant",
                    toolName: s.toolName,
                    name: s.toolName,
                    toolCallId: s.id,
                    toolArgs: JSON.stringify(s.args ?? {}),
                    content: "",
                    timestamp: now,
                },
                {
                    id: `event-approval-tool-result-${s.id}`,
                    phaseId: "approval",
                    phaseLabel: s.isError ? "Approved tool result (execution error)" : "Approved tool result",
                    kind: "tool",
                    role: "tool",
                    toolName: s.toolName,
                    toolCallId: s.id,
                    content: resultSnippet,
                    ...(s.isError ? { isError: true as const } : {}),
                    timestamp: now,
                },
            ];
        });
        const { agentGraphExecutor } = await import("@kletron/server/services/agentGraphExecutor");
        console.log(`[approvals] Resuming agent after approval for run ${runId}`);
        await agentGraphExecutor.continueRun(runId, "", {
            historyEvents,
            preserveMission: true,
            countAsConversationTurn: false,
            ...(userId ? { workspaceContextUserId: userId } : {}),
        });
        console.log(`[approvals] ✓ Agent resumed successfully for run ${runId}`);
    } catch (err) {
        console.error(`[approvals] ✗ Failed to resume agent after approval for ${runId}:`, (err as Error)?.message);
    }
}

async function resumeAgentAfterRejection(
    runId: string,
    rejectionSummaries: Array<{ id: string; toolName: string; args?: Record<string, unknown> }>,
    userId?: string,
) {
    try {
        const run = await agentGraphRunService.getRun(runId);
        if (!run) return;
        if (run.status === "RUNNING") {
            console.log(`[approvals] Run ${runId} still RUNNING, skipping rejection resume`);
            return;
        }
        const historyEvents: AgentEvent[] = rejectionSummaries.flatMap((s) => {
            const now = new Date().toISOString();
            return [
                {
                    id: `event-reject-tool-call-${s.id}`,
                    phaseId: "approval",
                    phaseLabel: "Rejected tool call",
                    kind: "assistant",
                    role: "assistant",
                    toolName: s.toolName,
                    name: s.toolName,
                    toolCallId: s.id,
                    toolArgs: JSON.stringify(s.args ?? {}),
                    content: "",
                    timestamp: now,
                },
                {
                    id: `event-reject-tool-result-${s.id}`,
                    phaseId: "approval",
                    phaseLabel: "Rejected tool result",
                    kind: "tool",
                    role: "tool",
                    toolName: s.toolName,
                    toolCallId: s.id,
                    content: "REJECTED_BY_USER: Do not repeat this exact tool call without changing the approach or asking for clarification.",
                    isError: true,
                    timestamp: now,
                },
            ];
        });
        const { agentGraphExecutor } = await import("@kletron/server/services/agentGraphExecutor");
        console.log(`[approvals] Resuming agent after rejection for run ${runId}`);
        await agentGraphExecutor.continueRun(runId, "", {
            historyEvents,
            preserveMission: true,
            countAsConversationTurn: false,
            ...(userId ? { workspaceContextUserId: userId } : {}),
        });
        console.log(`[approvals] ✓ Agent resumed successfully after rejection for ${runId}`);
    } catch (err) {
        console.error(`[approvals] ✗ Failed to resume agent after rejection for ${runId}:`, (err as Error)?.message);
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
    const workspaceIdStr = workspace._id.toString();

    const run = await agentGraphRunService.getRun(params.runId);
    if (!run || run.workspaceId?.toString() !== workspaceIdStr) {
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
        if (isKletronAdminToolName(toolName)) {
            const raw = await invokeKletronAdminToolForApproval({
                toolName,
                args: (edit.args ?? {}) as Record<string, unknown>,
                workspace,
                userId: auth.userId,
                runId: params.runId,
            });
            const evicted = await maybeEvictResult(workspace.rootPath, params.runId, toolName, raw);
            return { executed: true, result: evicted.content, evictedPath: evicted.evictedPath ?? undefined };
        }
        const client = await McpClient.getInstance();
        await syncWorkspaceExternalMcpServers(workspaceIdStr);
        const resolvedArgs = resolveApprovedToolArgs(toolName, edit.args ?? {}, workspace.rootPath);
        const raw = await client.callTool(toolName, resolvedArgs as any, {
            workspaceId: workspaceIdStr,
        });
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
            const hadStatePending = pendingIdx >= 0;

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
            } else if (hadStatePending) {
                pending.splice(pendingIdx, 1);
            }
            const approvals = await updateRunApprovals({ pending, granted });

            const errMsg = executionResult?.message ?? "Execution failed";
            if (executionResult?.executed) {
                void resumeAgentAfterApproval(params.runId, [{
                    id: String(edit.id),
                    toolName: edit.toolName,
                    args: (edit.args ?? {}) as Record<string, unknown>,
                    result: executionResult.result,
                    evictedPath: executionResult.evictedPath,
                }], auth.userId);
            } else if (hadStatePending) {
                void resumeAgentAfterApproval(params.runId, [{
                    id: String(edit.id),
                    toolName: edit.toolName,
                    args: (edit.args ?? {}) as Record<string, unknown>,
                    result: errMsg,
                    isError: true,
                }], auth.userId);
            }

            return NextResponse.json({
                approved: executionResult?.executed ? edit : null,
                executionResult,
                approvals,
                pendingAutoCleared: hadStatePending && !executionResult?.executed,
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
            void resumeAgentAfterRejection(params.runId, [{
                id: String(edit.id),
                toolName: edit.toolName,
                args: (edit.args ?? {}) as Record<string, unknown>,
            }], auth.userId);
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
            const executionSummaries: Array<{
                id: string;
                toolName: string;
                args?: Record<string, unknown>;
                result?: string;
                evictedPath?: string;
                isError?: boolean;
            }> = [];
            let approvedFailedCount = 0;

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
                    executionSummaries.push({
                        id: String(edit.id),
                        toolName: String(edit.toolName),
                        args: (edit.args ?? {}) as Record<string, unknown>,
                        result: executionResult.result,
                        evictedPath: executionResult.evictedPath,
                    });
                } else if (index >= 0) {
                    approvedFailedCount += 1;
                    pending.splice(index, 1);
                    executionSummaries.push({
                        id: String(edit.id),
                        toolName: String(edit.toolName),
                        args: (edit.args ?? {}) as Record<string, unknown>,
                        result: executionResult?.message ?? "Execution failed",
                        isError: true,
                    });
                }
            }
            const approvals = await updateRunApprovals({ pending, granted });

            if (executionSummaries.length > 0) {
                void resumeAgentAfterApproval(params.runId, executionSummaries, auth.userId);
            }

            return NextResponse.json({ approved: edits, approvals, approvedFailedCount });
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
            if (edits.length > 0) {
                void resumeAgentAfterRejection(
                    params.runId,
                    edits.map((edit: any) => ({
                        id: String(edit.id),
                        toolName: String(edit.toolName),
                        args: (edit.args ?? {}) as Record<string, unknown>,
                    })),
                    auth.userId,
                );
            }
            return NextResponse.json({ rejected: edits, approvals }, { status: 200 });
        }
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error)?.message ?? "Approval failed" }, { status: 500 });
    }
}
