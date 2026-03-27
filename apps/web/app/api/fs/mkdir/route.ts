import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const dirPath = (body as any).path;

  if (!dirPath || typeof dirPath !== "string") {
    return NextResponse.json({ error: "Missing or invalid path" }, { status: 400 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, body);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const repoRoot = workspace.rootPath;

  let fullPath = dirPath;
  if (!path.isAbsolute(dirPath)) {
    fullPath = path.resolve(repoRoot, dirPath);
  } else {
    fullPath = path.resolve(dirPath);
  }

  if (!fullPath.startsWith(repoRoot)) {
    return NextResponse.json(
      { error: "Access denied: path outside of repository root" },
      { status: 403 }
    );
  }

  try {
    if (fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "Directory already exists" }, { status: 409 });
    }

    fs.mkdirSync(fullPath, { recursive: true });
    return NextResponse.json({ success: true, path: fullPath });
  } catch (error) {
    console.error("Error creating directory:", error);
    return NextResponse.json({ error: "Failed to create directory" }, { status: 500 });
  }
}
