export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { tokenUsageService } from "@/src/services/tokenUsageService";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

/**
 * GET /api/token-usage/run/[id]
 * Get token usage for a specific run
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const auth = await requireAppRouteAuth(req);
        if (!auth) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const usage = await tokenUsageService.getRunUsage(params.id);
        return NextResponse.json({ usage }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/token-usage/run/${params.id}] Error:`, error);
        return NextResponse.json({ error: "Failed to get run token usage" }, { status: 500 });
    }
}
