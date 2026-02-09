export const dynamic = "force-dynamic";
import { agentGraphRunService } from "@numezis/server/services/agentGraphRunService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

/**
 * POST /api/sessions/[id]/stop - Mark a running session as COMPLETED.
 * Called by clients when they abort the streaming fetch so the server-side
 * run status reflects that the user stopped the session.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  console.log(`[sessions/stop] ▶ POST /api/sessions/${params.id}/stop`);

  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const run = await agentGraphRunService.getRun(params.id);
  if (!run) {
    console.log(`[sessions/stop] ✗ Session not found: ${params.id}`);
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[sessions/stop] Run status="${run.status}"`);

  // Transition any non-terminal status to COMPLETED
  const terminalStatuses = ["COMPLETED", "FAILED", "CANCELLED"];
  if (!terminalStatuses.includes(run.status)) {
    console.log(`[sessions/stop] Transitioning run ${params.id} from "${run.status}" → "COMPLETED"`);
    await agentGraphRunService.updateRunStatus(params.id, "COMPLETED", {
      endedAt: new Date(),
    } as any);
  }

  const finalStatus = terminalStatuses.includes(run.status) ? run.status : "COMPLETED";
  return new Response(JSON.stringify({ ok: true, status: finalStatus }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
