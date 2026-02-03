import { NextResponse } from "next/server";
import { clearVectors } from "@/src/services/vectorService";
import { getConfig } from "@/src/config";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export async function DELETE(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const cfg = await getConfig();
        await clearVectors(cfg.workingFolder);
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
