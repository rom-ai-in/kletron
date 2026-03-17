export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { getToolApprovalConfig, saveToolApprovalConfig } from "@kletron/server/config";

/**
 * GET /api/config/tool-approval — Return current tool approval config.
 */
export async function GET(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const config = getToolApprovalConfig();
    return NextResponse.json(config);
}

/**
 * PUT /api/config/tool-approval — Update tool approval config (partial merge).
 * Body: Partial<ToolApprovalConfig>
 * Example: { "toolOverrides": { "write_file": "always_approve" } }
 */
export async function PUT(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await req.json();
        const updated = await saveToolApprovalConfig(body);
        return NextResponse.json(updated);
    } catch (err) {
        return NextResponse.json(
            { error: (err as Error)?.message ?? "Failed to save config" },
            { status: 500 }
        );
    }
}
