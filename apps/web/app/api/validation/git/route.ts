import { NextRequest, NextResponse } from "next/server";
import simpleGit from "simple-git";
import fs from "node:fs";
import path from "node:path";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export async function POST(request: NextRequest) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json();
        const folderPath = body.path;

        if (!folderPath || typeof folderPath !== "string") {
            return NextResponse.json(
                { valid: false, error: "Path is required" },
                { status: 400 }
            );
        }

        const resolvedPath = path.resolve(folderPath);
        if (!fs.existsSync(resolvedPath)) {
            return NextResponse.json(
                { valid: false, error: "Directory does not exist" },
                { status: 400 }
            );
        }

        const git = simpleGit(resolvedPath);
        const isRepo = await git.checkIsRepo();

        if (!isRepo) {
            return NextResponse.json(
                { valid: false, error: "No GitHub repo detected" },
                { status: 200 }
            );
        }

        const branchSummary = await git.branch();

        return NextResponse.json({
            valid: true,
            currentBranch: branchSummary.current,
            branches: branchSummary.all,
        });
    } catch (e: any) {
        return NextResponse.json(
            { valid: false, error: e.message || "Failed to validate git repository" },
            { status: 500 }
        );
    }
}
