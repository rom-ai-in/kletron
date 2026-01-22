import { NextResponse } from "next/server";
import { clearVectors } from "@/src/services/vectorService";
import { config } from "@/src/config";

export async function DELETE() {
    try {
        await clearVectors(config.repoRoot);
        return NextResponse.json({
            success: true,
            message: "All vectors cleared for current repository"
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to clear vectors" },
            { status: 500 }
        );
    }
}
