export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import type { Workspace } from "@kletron/server/services/workspaceService";
import {
  createWorkspace,
  getActiveWorkspaceId,
  listWorkspaces,
  toWorkspaceSummary,
  validateWorkspaceRoot,
  workspaceSkipLocalFsValidation,
} from "@kletron/server/services/workspaceService";

function summaryWithHealth(workspace: Workspace) {
  const base = toWorkspaceSummary(workspace);
  const h = validateWorkspaceRoot(workspace);
  const skipFs = workspaceSkipLocalFsValidation();
  return {
    ...base,
    health: h.status,
    healthMessage: h.message ?? null,
    selectable: h.status === "healthy" || skipFs,
  };
}

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await listWorkspaces(auth.userId);
    const activeWorkspaceId = await getActiveWorkspaceId(auth.userId);
    const workspaces = raw.map(summaryWithHealth);
    return NextResponse.json({ workspaces, activeWorkspaceId });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to load workspaces" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      rootPath?: string;
      name?: string;
      repoUrl?: string;
      provider?: string;
      defaultBranch?: string;
    };
    const rootPath = body.rootPath?.trim();
    if (!rootPath) {
      return NextResponse.json({ error: "rootPath is required" }, { status: 400 });
    }

    const workspace = await createWorkspace({
      ownerId: auth.userId,
      rootPath,
      name: body.name?.trim(),
      repoUrl: body.repoUrl,
      provider: body.provider,
      defaultBranch: body.defaultBranch,
    });

    return NextResponse.json({ workspace: summaryWithHealth(workspace) }, { status: 201 });
  } catch (error) {
    const message = (error as Error)?.message ?? "Failed to create workspace";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
