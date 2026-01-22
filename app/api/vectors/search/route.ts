import { NextRequest, NextResponse } from "next/server";
import { semanticSearch } from "@/src/services/vectorService";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, path: searchPath, language, maxResults } = body;

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        const results = await semanticSearch(query, {
            path: searchPath,
            language,
            maxResults: maxResults ?? 5,
        });

        return NextResponse.json({ results });
    } catch (error) {
        console.error("Semantic search preview failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Search failed" },
            { status: 500 }
        );
    }
}
