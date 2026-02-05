import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { setActiveWorkspaceId, getWorkspaceById, toWorkspaceSummary } from "@numezis/server/services/workspaceService";
import { McpClient } from "@numezis/mcp-client/client";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workspace = await getWorkspaceById(params.id, auth.userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    await setActiveWorkspaceId(auth.userId, params.id);
    await McpClient.reloadInstance();
    return NextResponse.json({ workspace: toWorkspaceSummary(workspace) });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to select workspace" },
      { status: 500 }
    );
  }
}
