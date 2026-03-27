import { NextResponse } from "next/server";

import { runWorkflow } from "@kletron/agent-core/workflows";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";
import { runWithWorkspaceContext } from "@kletron/server/workspace/workspaceContext";

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  const graph = typeof payload?.graph === "string" ? payload.graph.trim() : undefined;

  if (!message) {
    return NextResponse.json(
      { error: "Please provide a user message in the request body." },
      { status: 400 }
    );
  }

  try {
    const workspace = await resolveWorkspaceFromRequestStrict(request, auth.userId, payload as any);
    if (!workspace || !workspace._id) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }
    return await runWithWorkspaceContext(workspace, async () => {
      const result = await runWorkflow(message, graph, {
        workspaceId: workspace._id!.toString(),
        source: "api",
      });
      return NextResponse.json(result);
    });
  } catch (error: unknown) {
    const workspaceError = workspaceErrorToHttp(error);
    if (workspaceError) {
      return NextResponse.json(workspaceError.body, { status: workspaceError.status });
    }
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Internal agent failure." },
      { status: 500 }
    );
  }
}
