import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

async function handleDelete(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const targetPath = (body as any).path;

  if (!targetPath || typeof targetPath !== "string") {
    return NextResponse.json({ error: "Missing or invalid path" }, { status: 400 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, body);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const repoRoot = workspace.rootPath;

  let fullPath = targetPath;
  if (!path.isAbsolute(targetPath)) {
    fullPath = path.resolve(repoRoot, targetPath);
  } else {
    fullPath = path.resolve(targetPath);
  }

  if (!fullPath.startsWith(repoRoot)) {
    return NextResponse.json(
      { error: "Access denied: path outside of repository root" },
      { status: 403 }
    );
  }

  if (fullPath === repoRoot) {
    return NextResponse.json({ error: "Cannot delete the working folder root" }, { status: 403 });
  }

  try {
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "Path not found" }, { status: 404 });
    }

    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting path:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  return handleDelete(request);
}

export async function POST(request: Request) {
  return handleDelete(request);
}
