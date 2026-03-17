export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { deleteWorkspace, getWorkspaceById, toWorkspaceSummary, getActiveWorkspaceId } from "@kletron/server/services/workspaceService";

export async function GET(request: Request, { params }: { params: { id: string } }) {
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
  const activeWorkspaceId = await getActiveWorkspaceId(auth.userId);
  return NextResponse.json({
    workspace: toWorkspaceSummary(workspace),
    activeWorkspaceId,
  });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await deleteWorkspace(params.id, auth.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to delete workspace" },
      { status: 500 }
    );
  }
}
