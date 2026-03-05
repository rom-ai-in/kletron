import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import {
  listWorkspaces,
  createWorkspace,
  getActiveWorkspaceId,
  toWorkspaceSummary,
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
    const workspaces = await listWorkspaces(auth.userId);
    const activeWorkspaceId = await getActiveWorkspaceId(auth.userId);
    const workspacesWithHealth = workspaces.map((workspace) => {
      const health = validateWorkspaceRoot(workspace);
      return {
        ...toWorkspaceSummary(workspace),
        health: health.status,
        healthMessage: health.message ?? null,
        selectable: health.status === "healthy",
      };
    });
    return NextResponse.json({
      workspaces: workspacesWithHealth,
      activeWorkspaceId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to list workspaces" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const rootPath = typeof body.rootPath === "string" ? body.rootPath : typeof (body as any).workingFolder === "string" ? (body as any).workingFolder : "";
  if (!rootPath) {
    return NextResponse.json({ error: "rootPath is required" }, { status: 400 });
  }

  try {
    const workspace = await createWorkspace({
      ownerId: auth.userId,
      rootPath,
      name: typeof body.name === "string" ? body.name : undefined,
      repoUrl: typeof body.repoUrl === "string" ? body.repoUrl : undefined,
      provider: typeof body.provider === "string" ? body.provider : undefined,
      defaultBranch: typeof body.defaultBranch === "string" ? body.defaultBranch : undefined,
    });
    return NextResponse.json({ workspace: toWorkspaceSummary(workspace) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to create workspace" },
      { status: 500 }
    );
  }
}
