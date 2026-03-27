export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { SafeEditGate } from "@kletron/server/services/agent/SafeEditGate";

const safeEditGate = SafeEditGate.getInstance();

/**
 * GET /api/sessions/[id]/edits - List pending edits for a session.
 * Merges edits from SafeEditGate and run state.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const run = await agentGraphRunService.getRun(params.id);

    // Merge pending edits from SafeEditGate and run state
    const pendingFromGate = safeEditGate.listPendingEdits(params.id);
    const pendingFromState = run?.state?.approvals?.pending
      ? (run.state.approvals.pending as Array<Record<string, unknown>>)
      : [];

    const seen = new Set<string>();
    const merged = [...pendingFromGate, ...pendingFromState].filter((item: any) => {
      const id = String(item?.id ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    return NextResponse.json(merged);
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Failed to list edits" }, { status: 500 });
  }
}
