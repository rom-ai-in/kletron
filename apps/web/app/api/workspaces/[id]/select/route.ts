import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import {
  setActiveWorkspaceId,
  getWorkspaceById,
  toWorkspaceSummary,
  validateWorkspaceRoot,
} from "@numezis/server/services/workspaceService";
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
  const health = validateWorkspaceRoot(workspace);
  if (health.status !== "healthy") {
    return NextResponse.json(
      {
        code: health.status === "missing" ? "WORKSPACE_PATH_MISSING" : "WORKSPACE_PATH_INACCESSIBLE",
        message: health.message ?? "Workspace path is invalid",
        workspaceId: workspace._id?.toString() ?? null,
        rootPath: workspace.rootPath,
        action: "select_or_fix_workspace",
      },
      { status: 422 }
    );
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
