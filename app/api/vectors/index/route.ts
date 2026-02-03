import { NextRequest, NextResponse } from "next/server";
import { startIndexing } from "@/src/services/indexerService";
import { getConfig } from "@/src/config";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export async function POST(request: NextRequest) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const cfg = await getConfig();
        const repoPath = cfg.workingFolder;

        // Start indexing in the background
        void startIndexing(repoPath, false);

        return NextResponse.json({
            success: true,
            message: "Indexing started in background"
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to start indexing" },
            { status: 500 }
        );
    }
}
