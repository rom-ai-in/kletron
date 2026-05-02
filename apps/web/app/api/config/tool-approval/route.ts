export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { saveToolApprovalConfig } from "@kletron/server/config";
import { getEffectiveToolApprovalForUser } from "@kletron/server/services/effectiveToolApprovalService";
import { getMembershipByUserId } from "@kletron/server/services/organizationService";
import { saveTenantToolApprovalConfig } from "@kletron/server/services/tenantToolApprovalService";

/**
 * GET /api/config/tool-approval — Effective tool approval config for the signed-in user.
 * Multi-tenant: per-organization doc when present; otherwise inherits deployment defaults.
 */
export async function GET(_req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { config, policyMeta } = await getEffectiveToolApprovalForUser(auth.userId);
        return NextResponse.json({ ...config, policyMeta });
    } catch (err) {
        console.error("[tool-approval GET]", err);
        return NextResponse.json(
            { error: (err as Error)?.message ?? "Failed to load tool approval policy" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/config/tool-approval — Update tool approval config (partial merge).
 * Body: Partial<ToolApprovalConfig> plus optional `replaceToolOverrides: true` to replace
 * the entire `toolOverrides` map (needed to remove entries).
 * Example: { "toolOverrides": { "write_file": "always_approve" }, "replaceToolOverrides": true }
 */
export async function PUT(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await req.json();
        const membership = await getMembershipByUserId(auth.userId);
        if (membership?.tenantId) {
            const updated = await saveTenantToolApprovalConfig(membership.tenantId.toString(), body);
            return NextResponse.json({
                ...updated,
                policyMeta: {
                    scope: "organization" as const,
                    hasOrganizationOverride: true,
                },
            });
        }
        const updated = await saveToolApprovalConfig(body);
        return NextResponse.json({
            ...updated,
            policyMeta: {
                scope: "deployment" as const,
                hasOrganizationOverride: false,
            },
        });
    } catch (err) {
        return NextResponse.json(
            { error: (err as Error)?.message ?? "Failed to save config" },
            { status: 500 }
        );
    }
}
