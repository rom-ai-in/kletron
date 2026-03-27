import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

/**
 * GET /api/fs/browse?path=/some/dir
 *
 * Lists directory entries (directories only) at the given absolute path.
 * Used by the AddWorkspaceModal to let users browse server-side folders.
 * Returns { entries: Array<{ name, path, isDirectory }>, parent: string | null }
 */
export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const browsePath = searchParams.get("path") || os.homedir();

    try {
        const resolved = path.resolve(browsePath);

        if (!fs.existsSync(resolved)) {
            return NextResponse.json({ error: "Path does not exist" }, { status: 400 });
        }

        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
            return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
        }

        const entries: Array<{ name: string; path: string; isDirectory: boolean }> = [];
        const items = fs.readdirSync(resolved);

        for (const item of items) {
            // Skip hidden files/folders except common ones
            if (item.startsWith(".") && item !== ".git") continue;
            const fullPath = path.join(resolved, item);
            try {
                const itemStat = fs.statSync(fullPath);
                if (itemStat.isDirectory()) {
                    entries.push({ name: item, path: fullPath, isDirectory: true });
                }
            } catch {
                // Skip entries we can't stat (permission errors, etc.)
            }
        }

        entries.sort((a, b) => a.name.localeCompare(b.name));

        const parent = path.dirname(resolved) !== resolved ? path.dirname(resolved) : null;

        return NextResponse.json({
            current: resolved,
            parent,
            entries,
        });
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error)?.message ?? "Failed to browse directory" },
            { status: 500 }
        );
    }
}
