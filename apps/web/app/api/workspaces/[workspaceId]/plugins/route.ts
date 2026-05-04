// Workspace plugin installs
//   GET  -> catalog + installed flags
//   POST -> { pluginId, action: "install" | "remove" }

import { NextResponse } from "next/server";
import { listPlugins } from "@kletron/shared";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    installPlugin,
    listInstalledPluginIds,
    removePlugin,
} from "@kletron/server/services/pluginsService";
import { getWorkspaceByIdUnsafe, getWorkspaceById } from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";

async function assertWorkspaceAccess(workspaceId: string, auth: { userId: string; authType: string }) {
    if (auth.authType === "internal") {
        return getWorkspaceByIdUnsafe(workspaceId);
    }
    return getWorkspaceById(workspaceId, auth.userId);
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId } = await params;
    const workspace = await assertWorkspaceAccess(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const [plugins, installedIds] = await Promise.all([
        Promise.resolve(listPlugins()),
        listInstalledPluginIds(workspaceId),
    ]);
    const installedSet = new Set(installedIds);
    const installed: Record<string, boolean> = {};
    for (const p of plugins) {
        installed[p.id] = installedSet.has(p.id);
    }

    return NextResponse.json({ workspaceId, plugins, installed });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId } = await params;
    const workspace = await assertWorkspaceAccess(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    let body: { pluginId?: string; action?: string } = {};
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const pluginId = typeof body.pluginId === "string" ? body.pluginId : null;
    const action = body.action === "remove" ? "remove" : body.action === "install" ? "install" : null;
    if (!pluginId || !action) {
        return NextResponse.json({ error: "pluginId and action (install|remove) required" }, { status: 400 });
    }

    try {
        if (action === "install") {
            await installPlugin(workspaceId, pluginId);
        } else {
            await removePlugin(workspaceId, pluginId);
        }
        const installedIds = await listInstalledPluginIds(workspaceId);
        const installedSet = new Set(installedIds);
        const installed: Record<string, boolean> = {};
        for (const p of listPlugins()) {
            installed[p.id] = installedSet.has(p.id);
        }
        return NextResponse.json({ ok: true, installed });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
