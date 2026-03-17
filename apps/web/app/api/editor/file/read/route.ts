import fs from "fs/promises";
import pathModule from "path";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const filePath = (body as any).path;
  if (!filePath) {
    return new Response(JSON.stringify({ error: "Missing path" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const workspace = await resolveWorkspaceFromRequest(request, auth.userId, body);
    if (!workspace || !workspace._id) {
      return new Response(JSON.stringify({ error: "Workspace not configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const absPath = pathModule.resolve(workspace.rootPath, filePath);
    const content = await fs.readFile(absPath, "utf8");
    return new Response(JSON.stringify({ content, path: absPath }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
