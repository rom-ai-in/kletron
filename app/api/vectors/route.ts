import { NextResponse } from "next/server";
import { getIndexStatus } from "@/src/services/indexerService";

export async function GET() {
    try {
        const status = getIndexStatus();
        return NextResponse.json({
            ...status,
            autoIndexEnabled: !process.env.DISABLE_AUTO_INDEX,
            lastAutoIndex: status.lastIndexedAt // For now, we use lastIndexedAt as proxy or we can track it separately
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to get index status" },
            { status: 500 }
        );
    }
}
