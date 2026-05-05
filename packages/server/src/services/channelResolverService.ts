import { ObjectId } from "mongodb";
import type { ChannelId } from "@kletron/shared/channelTypes";
import { agentGraphService } from "./agentGraphService";
import { channelChatContextService } from "./channelChatContextService";
import { channelStoreService } from "./channelStoreService";
import { workspaceChannelSettingsService } from "./workspaceChannelSettingsService";
import {
    getActiveWorkspaceId,
    getWorkspaceById,
    listWorkspaces,
    type Workspace,
} from "./workspaceService";

export type ResolveRoutingOk = {
    workspaceId: string;
    graphId: string;
    kletronUserId: string;
    actingUserId: string;
};

export type ResolveRoutingErr = {
    ok: false;
    reason: "not_linked" | "no_workspace" | "channel_disabled" | "no_graph";
    message: string;
};

/**
 * Pick workspace + graph for a channel message using chat context, /switch state, and workspace_channel_settings.
 */
export async function resolveChannelRouting(params: {
    channel: ChannelId;
    externalChatKey: string;
    externalUserId: string;
}): Promise<{ ok: true; data: ResolveRoutingOk } | ResolveRoutingErr> {
    const { channel, externalChatKey, externalUserId } = params;

    const kletronUserId =
        (await channelStoreService.findKletronUserIdForExternalUser(channel, externalUserId)) ?? null;
    if (!kletronUserId) {
        return {
            ok: false,
            reason: "not_linked",
            message:
                "Link your messenger account in Kletron: Settings → Configuration → Messenger channels (Telegram user id).",
        };
    }

    const workspaces = await listWorkspaces(kletronUserId);
    if (!workspaces.length) {
        return {
            ok: false,
            reason: "no_workspace",
            message: "No workspace found for your account. Create a workspace in the Kletron app first.",
        };
    }

    const ctx = await channelChatContextService.getByChatKey(channel, externalChatKey);

    let chosen: Workspace | null = null;

    if (ctx?.activeWorkspaceId) {
        const wsId = ctx.activeWorkspaceId.toString();
        chosen = await getWorkspaceById(wsId, kletronUserId);
    }

    if (!chosen) {
        const activeId = await getActiveWorkspaceId(kletronUserId);
        if (activeId) {
            chosen = await getWorkspaceById(activeId, kletronUserId);
        }
    }

    if (!chosen) {
        chosen = workspaces[0] ?? null;
    }

    if (!chosen?._id) {
        return {
            ok: false,
            reason: "no_workspace",
            message: "Could not resolve a workspace.",
        };
    }

    const settings = await workspaceChannelSettingsService.get(chosen._id.toString(), channel);
    const enabled = settings?.enabled ?? true;
    if (!enabled) {
        return {
            ok: false,
            reason: "channel_disabled",
            message: `Messenger channel is disabled for workspace "${chosen.name ?? chosen._id}". Enable it under Configuration → Messenger channels.`,
        };
    }

    let graphId = (settings?.defaultGraphId ?? "").trim();
    if (ctx?.graphOverrideId?.trim()) {
        graphId = ctx.graphOverrideId.trim();
    }

    if (!graphId) {
        return {
            ok: false,
            reason: "no_graph",
            message: `No default graph is configured for workspace "${chosen.name ?? chosen._id}". Configure one before using this messenger channel.`,
        };
    }

    const graph = await agentGraphService.getGraph(graphId);
    if (!graph?._id) {
        return {
            ok: false,
            reason: "no_graph",
            message: `Configured graph ${graphId} was not found. Update the messenger channel configuration.`,
        };
    }
    graphId = graph._id.toString();

    return {
        ok: true,
        data: {
            workspaceId: chosen._id.toString(),
            graphId,
            kletronUserId,
            actingUserId: kletronUserId,
        },
    };
}

export async function assertUserOwnsWorkspace(kletronUserId: string, workspaceId: string): Promise<boolean> {
    if (!ObjectId.isValid(workspaceId)) return false;
    const ws = await getWorkspaceById(workspaceId, kletronUserId);
    return Boolean(ws);
}
