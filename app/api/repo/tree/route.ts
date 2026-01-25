import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = "/Users/romainmagnin/Desktop/numezis";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const subPath = searchParams.get("path") || "";
        const absolutePath = path.join(REPO_ROOT, subPath);

        // Security check: ensure the path is within REPO_ROOT
        if (!absolutePath.startsWith(path.resolve(REPO_ROOT))) {
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
            .map(e => ({
                name: e.name,
                path: path.join(subPath, e.name),
                type: "file"
            }));

        return NextResponse.json({ folders, files });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
