import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { getActiveWorkspace, toWorkspaceSummary, getActiveWorkspaceId } from "@numezis/server/services/workspaceService";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const workspace = await getActiveWorkspace(auth.userId);
    const activeWorkspaceId = await getActiveWorkspaceId(auth.userId);
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
