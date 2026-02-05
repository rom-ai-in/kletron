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
  const filePath = (body as any).path;
  const content = (body as any).content;

  if (!filePath || typeof filePath !== "string") {
    return NextResponse.json({ error: "Missing or invalid path" }, { status: 400 });
  }

  if (typeof content !== "string") {
    return NextResponse.json({ error: "Content must be a string" }, { status: 400 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, body);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const repoRoot = workspace.rootPath;

  let fullPath = filePath;
  if (!path.isAbsolute(filePath)) {
    fullPath = path.resolve(repoRoot, filePath);
  } else {
    fullPath = path.resolve(filePath);
  }

  if (!fullPath.startsWith(repoRoot)) {
    return NextResponse.json(
      { error: "Access denied: path outside of repository root" },
      { status: 403 }
    );
  }

  try {
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf-8");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error writing file:", error);
    return NextResponse.json({ error: "Failed to write file" }, { status: 500 });
  }
}
