export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import {
  getActiveWorkspace,
  toWorkspaceSummary,
  getActiveWorkspaceId,
  listWorkspaces,
  setActiveWorkspaceId,
  validateWorkspaceRoot,
} from "@numezis/server/services/workspaceService";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let workspace = await getActiveWorkspace(auth.userId);
    let activeWorkspaceId = await getActiveWorkspaceId(auth.userId);
    if (workspace && workspace._id) {
      const health = validateWorkspaceRoot(workspace);
      if (health.status !== "healthy") {
        const candidates = await listWorkspaces(auth.userId);
        const nextHealthy = candidates.find((candidate) => validateWorkspaceRoot(candidate).status === "healthy");
        await setActiveWorkspaceId(auth.userId, nextHealthy?._id?.toString() ?? null);
        workspace = nextHealthy ?? null;
        activeWorkspaceId = nextHealthy?._id?.toString() ?? null;
      }
    }
    return NextResponse.json({
      workspace: workspace ? toWorkspaceSummary(workspace) : null,
      activeWorkspaceId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to load workspace" },
      { status: 500 }
    );
  }
}
