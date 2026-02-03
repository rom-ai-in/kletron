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

        // Force reindex in the background
        void startIndexing(repoPath, true);

        return NextResponse.json({
            success: true,
            message: "Reindexing started in background"
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to start reindexing" },
            { status: 500 }
        );
    }
}
