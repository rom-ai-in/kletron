import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const oldPath = (body as any).oldPath;
  const newPath = (body as any).newPath;

  if (!oldPath || typeof oldPath !== "string") {
    return NextResponse.json({ error: "Missing or invalid oldPath" }, { status: 400 });
  }

  if (!newPath || typeof newPath !== "string") {
    return NextResponse.json({ error: "Missing or invalid newPath" }, { status: 400 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, body);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const repoRoot = workspace.rootPath;

  const resolvedOldPath = path.isAbsolute(oldPath)
    ? path.resolve(oldPath)
    : path.resolve(repoRoot, oldPath);

  const resolvedNewPath = path.isAbsolute(newPath)
    ? path.resolve(newPath)
    : path.resolve(repoRoot, newPath);

  if (!resolvedOldPath.startsWith(repoRoot)) {
    return NextResponse.json({ error: "Access denied: oldPath outside of repository root" }, { status: 403 });
  }

  if (!resolvedNewPath.startsWith(repoRoot)) {
    return NextResponse.json({ error: "Access denied: newPath outside of repository root" }, { status: 403 });
  }

  try {
    if (!fs.existsSync(resolvedOldPath)) {
      return NextResponse.json({ error: "Source path not found" }, { status: 404 });
    }

    if (fs.existsSync(resolvedNewPath)) {
      return NextResponse.json({ error: "Target path already exists" }, { status: 409 });
    }

    fs.renameSync(resolvedOldPath, resolvedNewPath);
    return NextResponse.json({ success: true, newPath: resolvedNewPath });
  } catch (error) {
    console.error("Error renaming path:", error);
    return NextResponse.json({ error: "Failed to rename" }, { status: 500 });
  }
}
