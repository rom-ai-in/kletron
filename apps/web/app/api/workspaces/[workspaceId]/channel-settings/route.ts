import { NextResponse } from "next/server";
import type { ChannelId } from "@kletron/shared/channelTypes";
import { CHANNEL_IDS } from "@kletron/shared/channelTypes";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { workspaceChannelSettingsService } from "@kletron/server/services/workspaceChannelSettingsService";
import { getWorkspaceById } from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";

const CHANNEL_SET = new Set<string>(CHANNEL_IDS);

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const channel = (searchParams.get("channel") ?? "telegram").trim().toLowerCase();
    if (!CHANNEL_SET.has(channel)) {
        return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const workspace = await getWorkspaceById(workspaceId, auth.userId);
    if (!workspace) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const doc = await workspaceChannelSettingsService.get(workspaceId, channel as ChannelId);
    return NextResponse.json({
        workspaceId,
        channel,
        enabled: doc?.enabled ?? true,
        defaultGraphId: doc?.defaultGraphId ?? "",
    });
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
        channel?: string;
        enabled?: boolean;
        defaultGraphId?: string;
    };

    const channel = (body.channel ?? "telegram").trim().toLowerCase();
    if (!CHANNEL_SET.has(channel)) {
        return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const workspace = await getWorkspaceById(workspaceId, auth.userId);
    if (!workspace) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await workspaceChannelSettingsService.upsert(workspaceId, channel as ChannelId, {
        enabled: body.enabled,
        defaultGraphId: body.defaultGraphId,
        updatedByUserId: auth.userId,
    });

    return NextResponse.json({ ok: true });
}
