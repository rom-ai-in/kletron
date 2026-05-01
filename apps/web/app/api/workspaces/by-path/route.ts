// Resolve a workspace ObjectId from a root path. Used by the bundled MCP
// server to bridge from the on-disk workspace path it knows about to the
// Mongo workspace id used by the rest of the system.
//
// Auth: requires the internal MCP token (set MCP_INTERNAL_TOKEN). Without it,
// this would be a workspace-discovery oracle for any caller.

import path from "node:path";
import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { listAllWorkspaces } from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (auth.authType !== "internal") {
        return NextResponse.json({ error: "Internal callers only" }, { status: 403 });
    }

    const url = new URL(request.url);
    const raw = url.searchParams.get("path");
    if (!raw) return NextResponse.json({ error: "path is required" }, { status: 400 });
    const normalized = path.normalize(path.resolve(raw));

    const all = await listAllWorkspaces();
    const match = all.find(
        (w) => path.normalize(path.resolve(w.rootPath)) === normalized
    );
    if (!match) return NextResponse.json({ workspaceId: null });
    return NextResponse.json({ workspaceId: match._id?.toString() ?? null });
}
