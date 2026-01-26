import { NextResponse } from "next/server";
import { clearVectors } from "@/src/services/vectorService";
import { getConfig } from "@/src/config";

export async function DELETE() {
    try {
        const cfg = await getConfig();
        await clearVectors(cfg.mcpDefaultDir);
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
