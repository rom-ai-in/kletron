import { NextRequest, NextResponse } from "next/server";
import { startIndexing } from "@/src/services/indexerService";
import { config } from "@/src/config";

export async function POST(request: NextRequest) {
    try {
        const repoPath = config.repoRoot;

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
