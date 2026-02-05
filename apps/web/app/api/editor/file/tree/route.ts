import fs from "fs/promises";
import pathModule from "path";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(request.url);
  const queryPath = searchParams.get("path") ?? ".";

  try {
    const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
    if (!workspace || !workspace._id) {
      return new Response(JSON.stringify({ error: "Workspace not configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const absPath = pathModule.resolve(workspace.rootPath, queryPath);
    const entries = await fs.readdir(absPath, { withFileTypes: true });
    const payload = entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
    return new Response(JSON.stringify({ path: absPath, entries: payload }), {
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
