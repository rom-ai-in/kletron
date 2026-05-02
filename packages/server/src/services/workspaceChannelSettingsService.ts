import { ObjectId } from "mongodb";
import type { ChannelId } from "@kletron/shared/channelTypes";
import { getDb } from "../lib/db";

const COLLECTION = "workspace_channel_settings";

export type WorkspaceChannelSettingsDoc = {
    _id?: ObjectId;
    workspaceId: ObjectId;
    channel: ChannelId;
    enabled: boolean;
    defaultGraphId: string;
    updatedAt: Date;
    updatedByUserId?: ObjectId;
};

export class WorkspaceChannelSettingsService {
    async get(workspaceId: string, channel: ChannelId): Promise<WorkspaceChannelSettingsDoc | null> {
        if (!ObjectId.isValid(workspaceId)) return null;
        const col = (await getDb()).collection<WorkspaceChannelSettingsDoc>(COLLECTION);
        return col.findOne({ workspaceId: new ObjectId(workspaceId), channel });
    }

    async upsert(
        workspaceId: string,
        channel: ChannelId,
        patch: {
            enabled?: boolean;
            defaultGraphId?: string;
            updatedByUserId?: string;
        }
    ): Promise<void> {
        if (!ObjectId.isValid(workspaceId)) throw new Error("Invalid workspace id");
        const col = (await getDb()).collection(COLLECTION);
        const now = new Date();
        const set: Record<string, unknown> = { updatedAt: now };
        if (typeof patch.enabled === "boolean") set.enabled = patch.enabled;
        if (typeof patch.defaultGraphId === "string") set.defaultGraphId = patch.defaultGraphId.trim();
        if (patch.updatedByUserId && ObjectId.isValid(patch.updatedByUserId)) {
            set.updatedByUserId = new ObjectId(patch.updatedByUserId);
        }
        await col.updateOne(
            { workspaceId: new ObjectId(workspaceId), channel },
            {
                $set: set,
                $setOnInsert: {
                    workspaceId: new ObjectId(workspaceId),
                    channel,
                    enabled: true,
                    defaultGraphId: "",
                },
            },
            { upsert: true }
        );
    }
}

export const workspaceChannelSettingsService = new WorkspaceChannelSettingsService();

export async function ensureWorkspaceChannelSettingsIndexes(): Promise<void> {
    try {
        const db = await getDb();
        await db.collection(COLLECTION).createIndex({ workspaceId: 1, channel: 1 }, { unique: true });
    } catch (e) {
        console.warn("[WorkspaceChannelSettings] ensureIndexes:", (e as Error)?.message ?? e);
    }
}
