import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import type { AgentEvent } from "@kletron/shared/types";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { SafeEditGate } from "@kletron/server/services/agent/SafeEditGate";

const safeEditGate = SafeEditGate.getInstance();

/**
 * Fire-and-forget: resume the agent loop after a rejected tool call.
 * We append synthetic tool-call/tool-result events so the agent sees the
 * rejection as tool feedback rather than as a fake user message.
 */
async function resumeAgentAfterRejection(
  runId: string,
  rejectionSummaries: Array<{ id: string; toolName: string; args?: Record<string, unknown> }>,
  userId?: string,
) {
  try {
    const run = await agentGraphRunService.getRun(runId);
    if (!run) return;
    if (run.status === "RUNNING") {
      console.log(`[edits/reject] Run ${runId} still RUNNING, skipping resume`);
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
    console.log(`[edits/reject] Resuming agent after rejection for run ${runId}`);
    await agentGraphExecutor.continueRun(runId, "", {
      historyEvents,
      preserveMission: true,
      countAsConversationTurn: false,
      ...(userId ? { workspaceContextUserId: userId } : {}),
    });
    console.log(`[edits/reject] ✓ Agent resumed successfully for run ${runId}`);
  } catch (err) {
    console.error(`[edits/reject] ✗ Failed to resume agent after rejection for ${runId}:`, (err as Error)?.message);
  }
}

/**
 * POST /api/sessions/[id]/edits/reject - Reject edit(s).
 * Body: { editId: string } or { action: "all" }
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await agentGraphRunService.getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const editId = typeof body?.editId === "string" ? body.editId : "";
  const action = typeof body?.action === "string" ? body.action : "";

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
        return gateEdit ? safeEditGate.rejectEdit(edit.id) : edit;
      });

      const rejected = Array.isArray(run.state?.approvals?.rejected) ? [...run.state.approvals.rejected as any[]] : [];
      const rejectionSummaries: Array<{ id: string; toolName: string; args?: Record<string, unknown> }> = [];
      for (const edit of edits) {
        rejected.push({
          id: edit.id, toolName: edit.toolName, args: edit.args,
          status: "rejected", rejectedAt: new Date().toISOString(),
        });
        rejectionSummaries.push({
          id: String(edit.id),
          toolName: edit.toolName,
          args: (edit.args ?? {}) as Record<string, unknown>,
        });
      }
      const approvals = await updateRunApprovals({ pending: [], rejected });
      
      if (rejectionSummaries.length > 0) {
        void resumeAgentAfterRejection(params.id, rejectionSummaries, auth.userId);
      }
      
      return NextResponse.json({ rejected: edits, approvals });
    }

    if (!editId) {
      return NextResponse.json({ error: "editId is required" }, { status: 400 });
    }

    const existing = safeEditGate.getPendingEdit(editId);
    const pendingFromState = Array.isArray(run.state?.approvals?.pending) ? run.state.approvals.pending : [];
    const fallback = (pendingFromState as any[]).find((p: any) => p?.id === editId);
    if (!existing && !fallback) {
      return NextResponse.json({ error: "Edit not found" }, { status: 404 });
    }
    const edit = existing ? safeEditGate.rejectEdit(editId) : fallback;

    const pending = Array.isArray(run.state?.approvals?.pending)
      ? (run.state.approvals.pending as any[]).filter((p: any) => p?.id !== editId) : [];
    const rejected = Array.isArray(run.state?.approvals?.rejected) ? [...run.state.approvals.rejected as any[]] : [];
    rejected.push({
      id: edit.id, toolName: edit.toolName, args: edit.args,
      status: "rejected", rejectedAt: new Date().toISOString(),
    });
    const approvals = await updateRunApprovals({ pending, rejected });

      void resumeAgentAfterRejection(params.id, [{
        id: String(edit.id),
        toolName: edit.toolName,
        args: (edit.args ?? {}) as Record<string, unknown>,
      }], auth.userId);

    return NextResponse.json({ rejected: edit, approvals });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Rejection failed" }, { status: 500 });
  }
}
