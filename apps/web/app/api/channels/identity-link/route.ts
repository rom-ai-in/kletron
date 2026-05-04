import { NextResponse } from "next/server";
import { CHANNEL_IDS } from "@kletron/shared/channelTypes";
import type { ChannelId } from "@kletron/shared/channelTypes";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { channelStoreService } from "@kletron/server/services/channelStoreService";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";

const CHANNEL_SET = new Set<string>(CHANNEL_IDS);

/**
 * POST /api/channels/identity-link
 * Links the signed-in user to an external messenger id for a workspace (tool audit / permissions).
 * Body: { channel, externalUserId } + workspace resolution fields (same as other app routes).
 */
export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({} as Record<string, unknown>));
    const channelRaw = typeof payload?.channel === "string" ? payload.channel.trim().toLowerCase() : "";
    const externalUserId = typeof payload?.externalUserId === "string" ? payload.externalUserId.trim() : "";

    if (!CHANNEL_SET.has(channelRaw) || !externalUserId) {
        return NextResponse.json(
            { error: "Provide channel (telegram|slack|whatsapp) and externalUserId." },
            { status: 400 }
        );
    }

    let workspace;
    try {
        workspace = await resolveWorkspaceFromRequestStrict(request, auth.userId, payload as any);
    } catch (error: unknown) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        throw error;
    }

    if (!workspace?._id) {
        return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }

    await channelStoreService.linkUser({
        workspaceId: workspace._id.toString(),
        channel: channelRaw as ChannelId,
        externalUserId,
        kletronUserId: auth.userId,
    });

    return NextResponse.json({ ok: true });
}
