import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import type { ChannelId } from "@kletron/shared/channelTypes";
import { getDb } from "../lib/db";

const SESSIONS = "channel_sessions";
const DEDUP = "channel_inbound_processed";
const USER_LINKS = "channel_user_links";

export type ChannelSessionDoc = {
    _id?: ObjectId;
    sessionKey: string;
    runId: ObjectId;
    workspaceId: ObjectId;
    channel: ChannelId;
    externalChatKey: string;
    updatedAt: Date;
};

export type ChannelUserLinkDoc = {
    _id?: ObjectId;
    workspaceId: ObjectId;
    channel: ChannelId;
    externalUserId: string;
    kletronUserId: ObjectId;
    createdAt: Date;
};

function sessionKey(workspaceId: string, channel: ChannelId, externalChatKey: string): string {
    const h = createHash("sha256").update(externalChatKey, "utf8").digest("hex").slice(0, 32);
    return `${workspaceId}:${channel}:${h}`;
}

export function buildChannelSessionKey(workspaceId: string, channel: ChannelId, externalChatKey: string): string {
    return sessionKey(workspaceId, channel, externalChatKey);
}

export class ChannelStoreService {
    /**
     * Returns false if this inbound message was already processed (idempotent).
     */
    async tryClaimInboundMessage(
        channel: ChannelId,
        inboundMessageId: string
    ): Promise<boolean> {
        if (!inboundMessageId) return true;
        const collection = (await getDb()).collection(DEDUP);
        try {
            await collection.insertOne({
                channel,
                inboundMessageId,
                processedAt: new Date(),
            });
            return true;
        } catch (err: unknown) {
            const code = (err as { code?: number })?.code;
            if (code === 11000) return false;
            throw err;
        }
    }

    async getRunIdForSession(sessionKey: string): Promise<string | null> {
        const collection = (await getDb()).collection<ChannelSessionDoc>(SESSIONS);
        const doc = await collection.findOne({ sessionKey });
        return doc?.runId?.toString() ?? null;
    }

    async upsertSession(params: {
        sessionKey: string;
        runId: string;
        workspaceId: string;
        channel: ChannelId;
        externalChatKey: string;
    }): Promise<void> {
        const collection = (await getDb()).collection(SESSIONS);
        const runId = new ObjectId(params.runId);
        const workspaceId = new ObjectId(params.workspaceId);
        await collection.updateOne(
            { sessionKey: params.sessionKey },
            {
                $set: {
                    runId,
                    workspaceId,
                    channel: params.channel,
                    externalChatKey: params.externalChatKey,
                    updatedAt: new Date(),
                },
            },
            { upsert: true }
        );
    }

    async findLinkedKletronUserId(
        workspaceId: string,
        channel: ChannelId,
        externalUserId: string
    ): Promise<string | null> {
        if (!ObjectId.isValid(workspaceId)) return null;
        const collection = (await getDb()).collection<ChannelUserLinkDoc>(USER_LINKS);
        const doc = await collection.findOne({
            workspaceId: new ObjectId(workspaceId),
            channel,
            externalUserId,
        });
        return doc?.kletronUserId?.toString() ?? null;
    }

    /** Any workspace link for this messenger user (for routing without a fixed workspace in the link row). */
    async findKletronUserIdForExternalUser(channel: ChannelId, externalUserId: string): Promise<string | null> {
        const collection = (await getDb()).collection<ChannelUserLinkDoc>(USER_LINKS);
        const doc = await collection.findOne({ channel, externalUserId });
        return doc?.kletronUserId?.toString() ?? null;
    }

    async linkUser(params: {
        workspaceId: string;
        channel: ChannelId;
        externalUserId: string;
        kletronUserId: string;
    }): Promise<void> {
        const collection = (await getDb()).collection(USER_LINKS);
        await collection.updateOne(
            {
                workspaceId: new ObjectId(params.workspaceId),
                channel: params.channel,
                externalUserId: params.externalUserId,
            },
            {
                $set: {
                    kletronUserId: new ObjectId(params.kletronUserId),
                    createdAt: new Date(),
                },
            },
            { upsert: true }
        );
    }
}

export const channelStoreService = new ChannelStoreService();

/** Ensure indexes once at startup (idempotent). */
export async function ensureChannelStoreIndexes(): Promise<void> {
    try {
        const db = await getDb();
        await db.collection(DEDUP).createIndex(
            { channel: 1, inboundMessageId: 1 },
            { unique: true }
        );
        await db.collection(SESSIONS).createIndex({ sessionKey: 1 }, { unique: true });
        await db.collection(USER_LINKS).createIndex(
            { workspaceId: 1, channel: 1, externalUserId: 1 },
            { unique: true }
        );
        await db.collection(USER_LINKS).createIndex({ channel: 1, externalUserId: 1 });

        const { ensureWorkspaceChannelSettingsIndexes } = await import("./workspaceChannelSettingsService");
        const { ensureChannelAppSecretsIndexes } = await import("./channelAppSecretsService");
        const { ensureChannelChatContextIndexes } = await import("./channelChatContextService");
        const { ensureChannelInboundJobIndexes } = await import("./channelInboundJobService");
        await ensureWorkspaceChannelSettingsIndexes();
        await ensureChannelAppSecretsIndexes();
        await ensureChannelChatContextIndexes();
        await ensureChannelInboundJobIndexes();
    } catch (e) {
        console.warn("[ChannelStore] ensureIndexes:", (e as Error)?.message ?? e);
    }
}
