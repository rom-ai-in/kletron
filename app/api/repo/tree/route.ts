import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { getConfig } from "@/src/config";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const subPath = searchParams.get("path") || "";

        const config = await getConfig();
        const repoRoot = config.mcpDefaultDir;

        if (!repoRoot || !existsSync(repoRoot)) {
            return NextResponse.json({ error: "Repository root not configured or does not exist" }, { status: 500 });
        }

        const absolutePath = path.join(repoRoot, subPath);

        // Security check: ensure the path is within repoRoot (prevent path traversal)
        const resolvedRoot = path.resolve(repoRoot);
        if (!path.resolve(absolutePath).startsWith(resolvedRoot)) {
            return NextResponse.json({ error: "Unauthorized path access" }, { status: 403 });
        }

        const entries = await fs.readdir(absolutePath, { withFileTypes: true });

        const folders = entries
            .filter(e => e.isDirectory())
            .filter(e => !["node_modules", ".git", "dist", "build", ".next", ".antigravity"].includes(e.name))
            .map(e => ({
                name: e.name,
                path: path.join(subPath, e.name),
                type: "directory"
            }));

        const files = entries
            .filter(e => e.isFile())
            .filter(e => !e.name.startsWith(".")) // Optional: hide dotfiles
            .map(e => ({
                name: e.name,
                path: path.join(subPath, e.name),
                type: "file"
            }));

        // Sort folders first, then files
        folders.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ folders, files });
    } catch (error: any) {
        console.error("Tree API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
