import { ObjectId } from "mongodb";
import type { ChannelId } from "@kletron/shared/channelTypes";
import { getDb } from "../lib/db";

const COLLECTION = "channel_chat_context";

export type ChannelPendingState =
    | { kind: "awaiting_workspace_index" }
    | { kind: "awaiting_graph_index" };

export type ChannelChatContextDoc = {
    _id?: ObjectId;
    channel: ChannelId;
    externalChatKey: string;
    externalUserId: string;
    kletronUserId: ObjectId;
    activeWorkspaceId?: ObjectId;
    /** Optional graph override for this chat */
    graphOverrideId?: string;
    pending?: ChannelPendingState;
    updatedAt: Date;
};

export class ChannelChatContextService {
    async getByChatKey(channel: ChannelId, externalChatKey: string): Promise<ChannelChatContextDoc | null> {
        const col = (await getDb()).collection<ChannelChatContextDoc>(COLLECTION);
        return col.findOne({ channel, externalChatKey });
    }

    async upsertContext(params: {
        channel: ChannelId;
        externalChatKey: string;
        externalUserId: string;
        kletronUserId: string;
        activeWorkspaceId?: string;
        graphOverrideId?: string | null;
        pending?: ChannelPendingState | null;
    }): Promise<void> {
        if (!ObjectId.isValid(params.kletronUserId)) throw new Error("Invalid kletron user id");
        const col = (await getDb()).collection(COLLECTION);
        const now = new Date();
        const $set: Record<string, unknown> = {
            externalUserId: params.externalUserId,
            kletronUserId: new ObjectId(params.kletronUserId),
            updatedAt: now,
        };
        if (params.activeWorkspaceId && ObjectId.isValid(params.activeWorkspaceId)) {
            $set.activeWorkspaceId = new ObjectId(params.activeWorkspaceId);
        }
        if (params.graphOverrideId === null) {
            $set.graphOverrideId = null;
        } else if (typeof params.graphOverrideId === "string") {
            $set.graphOverrideId = params.graphOverrideId.trim();
        }
        if ("pending" in params && params.pending !== undefined) {
            $set.pending = params.pending;
        }
        await col.updateOne(
            { channel: params.channel, externalChatKey: params.externalChatKey },
            {
                $set,
                $setOnInsert: {
                    channel: params.channel,
                    externalChatKey: params.externalChatKey,
                },
            },
            { upsert: true }
        );
    }

    async setActiveWorkspace(
        channel: ChannelId,
        externalChatKey: string,
        externalUserId: string,
        kletronUserId: string,
        activeWorkspaceId: string
    ): Promise<void> {
        await this.upsertContext({
            channel,
            externalChatKey,
            externalUserId,
            kletronUserId,
            activeWorkspaceId,
            pending: null,
        });
    }

    async setPending(
        channel: ChannelId,
        externalChatKey: string,
        externalUserId: string,
        kletronUserId: string,
        pending: ChannelPendingState | null
    ): Promise<void> {
        await this.upsertContext({
            channel,
            externalChatKey,
            externalUserId,
            kletronUserId,
            pending,
        });
    }

    /** Per-chat graph override (resolver prefers this over workspace default). Pass null to clear. */
    async setGraphOverride(
        channel: ChannelId,
        externalChatKey: string,
        externalUserId: string,
        kletronUserId: string,
        graphId: string | null
    ): Promise<void> {
        await this.upsertContext({
            channel,
            externalChatKey,
            externalUserId,
            kletronUserId,
            graphOverrideId: graphId === null ? null : graphId.trim(),
            pending: null,
        });
    }
}

export const channelChatContextService = new ChannelChatContextService();

export async function ensureChannelChatContextIndexes(): Promise<void> {
    try {
        const db = await getDb();
        await db.collection(COLLECTION).createIndex({ channel: 1, externalChatKey: 1 }, { unique: true });
    } catch (e) {
        console.warn("[ChannelChatContext] ensureIndexes:", (e as Error)?.message ?? e);
    }
}
