import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";

/**
 * POST /api/sessions/[id]/truncate - Truncate conversation history after a given index.
 * Body: { afterIndex: number }
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const afterIndex = typeof body?.afterIndex === "number" ? body.afterIndex : -1;

  if (afterIndex < 0) {
    return NextResponse.json({ error: "afterIndex must be >= 0" }, { status: 400 });
  }

  try {
    const run = await agentGraphRunService.getRun(params.id);
    if (!run) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const history = run.state?.conversationHistory ?? [];
    const removed = history.splice(afterIndex);
    run.state.conversationHistory = history;

    await agentGraphRunService.updateRunState(params.id, run.state);

    return NextResponse.json({ success: true, removedCount: removed.length });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Failed to truncate" }, { status: 500 });
  }
}
