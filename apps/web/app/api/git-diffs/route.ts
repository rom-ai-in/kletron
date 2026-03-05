import { NextResponse } from 'next/server';
import path from "node:path";
import { getDiffsForWindow } from '@numezis/server/services/gitLocalService';
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@numezis/server/services/workspaceService";
import { runWithWorkspaceContext } from "@numezis/server/workspace/workspaceContext";

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const url = new URL(request.url);
    const pathValue = url.searchParams.get('path');
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const granularity = url.searchParams.get('granularity') ?? 'day';

    if (pathValue === null || !start || !end) {
        return NextResponse.json(
            { error: 'Missing required query parameters: path, start, end' },
            { status: 400 }
        );
    }

    try {
        const workspace = await resolveWorkspaceFromRequestStrict(request, auth.userId, null);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const repoRoot = path.resolve(workspace.rootPath);
        const rawPath = (pathValue ?? "").trim();
        let relativePath = "";

        if (rawPath && rawPath !== "/") {
            const absolute = path.isAbsolute(rawPath)
                ? path.resolve(rawPath)
                : path.resolve(repoRoot, rawPath);
            if (!absolute.startsWith(repoRoot)) {
                return NextResponse.json({ error: "Path outside workspace root" }, { status: 403 });
            }
            relativePath = path.relative(repoRoot, absolute);
        }

        return await runWithWorkspaceContext(workspace, async () => {
            const diffs = await getDiffsForWindow(relativePath, start, end);
            return NextResponse.json({ diffs, granularity });
        });
    } catch (e: any) {
        const workspaceError = workspaceErrorToHttp(e);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error('Git diff API error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
