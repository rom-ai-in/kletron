import { NextResponse } from "next/server";
import { getIndexStatus } from "@/src/services/indexerService";

export async function GET() {
    try {
        const status = getIndexStatus();
        return NextResponse.json(status);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to get index status" },
            { status: 500 }
        );
    }
}
