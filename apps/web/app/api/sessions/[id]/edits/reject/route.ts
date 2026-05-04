import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { SafeEditGate } from "@kletron/server/services/agent/SafeEditGate";

const safeEditGate = SafeEditGate.getInstance();

/**
 * Fire-and-forget: resume the agent loop after a rejected tool call.
 * The LLM receives a synthetic user message describing what was rejected,
 * then continues its reasoning.
 */
async function resumeAgentAfterRejection(
  runId: string,
  rejectionSummaries: Array<{ toolName: string; }>
) {
  try {
    const run = await agentGraphRunService.getRun(runId);
    if (!run) return;
    if (run.status === "RUNNING") {
      console.log(`[edits/reject] Run ${runId} still RUNNING, skipping resume`);
      return;
    }

    const parts = rejectionSummaries.map((s) => {
      return `Tool \`${s.toolName}\` was REJECTED by the user. Do not attempt this exact tool call again without modifying your approach.`;
    });
    const message = parts.join("\n\n---\n\n") + "\n\nPlease continue with the task or ask the user for clarification.";

    const { agentGraphExecutor } = await import("@kletron/server/services/agentGraphExecutor");
    console.log(`[edits/reject] Resuming agent after rejection for run ${runId}`);
    await agentGraphExecutor.continueRun(runId, message, {});
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
      const rejectionSummaries: Array<{ toolName: string }> = [];
      for (const edit of edits) {
        rejected.push({
          id: edit.id, toolName: edit.toolName, args: edit.args,
          status: "rejected", rejectedAt: new Date().toISOString(),
        });
        rejectionSummaries.push({ toolName: edit.toolName });
      }
      const approvals = await updateRunApprovals({ pending: [], rejected });
      
      if (rejectionSummaries.length > 0) {
        void resumeAgentAfterRejection(params.id, rejectionSummaries);
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

    void resumeAgentAfterRejection(params.id, [{ toolName: edit.toolName }]);

    return NextResponse.json({ rejected: edit, approvals });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Rejection failed" }, { status: 500 });
  }
}
