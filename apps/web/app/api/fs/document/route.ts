import fs from "fs";
import path from "path";
import { getMimeType } from "@kletron/shared/utils/fileTypes";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return new Response(JSON.stringify({ error: "Missing or invalid path" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
  if (!workspace || !workspace._id) {
    return new Response(JSON.stringify({ error: "Workspace not configured" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const repoRoot = workspace.rootPath;

  let fullPath = filePath;
  if (!path.isAbsolute(filePath)) {
    fullPath = path.resolve(repoRoot, filePath);
  } else {
    fullPath = path.resolve(filePath);
  }

  if (!fullPath.startsWith(repoRoot)) {
    return new Response(JSON.stringify({ error: "Access denied: path outside of repository root" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (!fs.existsSync(fullPath)) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return new Response(JSON.stringify({ error: "Not a file" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = fs.readFileSync(fullPath);
    const mimeType = getMimeType(fullPath);
    const fileName = path.basename(fullPath);

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error reading document:", error);
    return new Response(JSON.stringify({ error: "Failed to read document" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
