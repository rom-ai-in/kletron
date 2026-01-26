import { NextRequest, NextResponse } from "next/server";
import { startIndexing } from "@/src/services/indexerService";
import { getConfig } from "@/src/config";

export async function POST(request: NextRequest) {
    try {
        const cfg = await getConfig();
        const repoPath = cfg.mcpDefaultDir;

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
