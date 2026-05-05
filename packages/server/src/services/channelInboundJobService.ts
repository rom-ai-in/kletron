import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import type { TelegramUpdate } from "./telegramChannelAdapter";
import { executeTelegramInboundUpdate } from "./telegramInboundProcessor";

const COLLECTION = "channel_inbound_jobs";

export type ChannelInboundJobDoc = {
    _id?: ObjectId;
    channel: "telegram";
    payload: TelegramUpdate;
    status: "pending" | "processing" | "failed";
    createdAt: Date;
    claimedAt?: Date;
    lastError?: string;
};

export async function ensureChannelInboundJobIndexes(): Promise<void> {
    try {
        const db = await getDb();
        await db.collection(COLLECTION).createIndex({ channel: 1, status: 1, createdAt: 1 });
    } catch (e) {
        console.warn("[ChannelInboundJobs] ensureIndexes:", (e as Error)?.message ?? e);
    }
}

/**
 * Persist update then process pending jobs FIFO. Survives multi-instance deploys: each instance drains atomically.
 */
export async function enqueueTelegramInboundJob(payload: TelegramUpdate): Promise<void> {
    const backend = process.env.CHANNEL_TELEGRAM_QUEUE_BACKEND?.trim().toLowerCase();
    if (backend === "memory") {
        void executeTelegramInboundUpdate(payload);
        return;
    }

    const db = await getDb();
    await db.collection(COLLECTION).insertOne({
        channel: "telegram",
        payload,
        status: "pending",
        createdAt: new Date(),
    } satisfies Omit<ChannelInboundJobDoc, "_id">);

    void drainTelegramInboundJobs();
}

export async function drainTelegramInboundJobs(): Promise<void> {
    const backend = process.env.CHANNEL_TELEGRAM_QUEUE_BACKEND?.trim().toLowerCase();
    if (backend === "memory") return;

    const db = await getDb();
    const col = db.collection<ChannelInboundJobDoc>(COLLECTION);

    for (;;) {
        const res = await col.findOneAndUpdate(
            { channel: "telegram", status: "pending" },
            { $set: { status: "processing", claimedAt: new Date() } },
            { sort: { createdAt: 1 }, returnDocument: "after" }
        );

        const job = res;
        if (!job?._id) break;

        try {
            await executeTelegramInboundUpdate(job.payload);
            await col.deleteOne({ _id: job._id });
        } catch (e) {
            const msg = (e as Error)?.message ?? String(e);
            console.error("[ChannelInboundJobs] job failed:", msg);
            await col.updateOne(
                { _id: job._id },
                { $set: { status: "failed", lastError: msg.slice(0, 2000) } }
            );
        }
    }
}
