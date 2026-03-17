import { NextRequest, NextResponse } from "next/server";
import { semanticSearch } from "@kletron/server/services/vectorService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";

export async function POST(request: NextRequest) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json();
        const { query, path: searchPath, language, maxResults } = body;

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        const workspace = await resolveWorkspaceFromRequestStrict(request, auth.userId, body);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const results = await semanticSearch(query, {
            repoPath: workspace.rootPath,
            path: searchPath,
            language,
            maxResults: maxResults ?? 5,
        });

        return NextResponse.json({ results });
    } catch (error) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error("Semantic search preview failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Search failed" },
            { status: 500 }
        );
    }
}
