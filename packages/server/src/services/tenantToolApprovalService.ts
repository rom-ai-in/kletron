/**
 * Per-tenant tool approval policy persisted in MongoDB (multi-org).
 * Falls back to deployment-wide config from workspace_configs when no doc exists.
 */
import { ObjectId } from "mongodb";
import type { SaveToolApprovalConfigInput, ToolApprovalConfig } from "../config";
import { getToolApprovalConfig, mergeToolApprovalConfigUpdates } from "../config";
import { getDatabase } from "../lib/db";

const COLLECTION = "tenant_tool_approval";

type TenantToolApprovalDoc = ToolApprovalConfig & {
    _id?: ObjectId;
    tenantId: ObjectId;
    updatedAt?: Date;
    createdAt?: Date;
};

export async function getTenantToolApprovalConfig(tenantId: string): Promise<ToolApprovalConfig | null> {
    if (!ObjectId.isValid(tenantId)) return null;
    try {
        const db = await getDatabase();
        const doc = await db.collection<TenantToolApprovalDoc>(COLLECTION).findOne({ tenantId: new ObjectId(tenantId) });
        if (!doc) return null;
        return {
            autoApproveReadonlySources: doc.autoApproveReadonlySources ?? ["agent", "automation"],
            neverAutoApproveTools: doc.neverAutoApproveTools ?? [],
            autoApproveSafeBash: doc.autoApproveSafeBash !== false,
            toolOverrides: doc.toolOverrides ?? {},
            defaultThreadApprovalMode: doc.defaultThreadApprovalMode ?? "inherit",
        };
    } catch {
        return null;
    }
}

export async function saveTenantToolApprovalConfig(
    tenantId: string,
    updates: SaveToolApprovalConfigInput
): Promise<ToolApprovalConfig> {
    if (!ObjectId.isValid(tenantId)) {
        throw new Error("Invalid tenant id");
    }
    const db = await getDatabase();
    const collection = db.collection<TenantToolApprovalDoc>(COLLECTION);
    const tid = new ObjectId(tenantId);
    const existing = await collection.findOne({ tenantId: tid });
    const base = existing
        ? (() => {
              const { _id, tenantId: _t, updatedAt, createdAt, ...rest } = existing as TenantToolApprovalDoc &
                  Record<string, unknown>;
              return rest as ToolApprovalConfig;
          })()
        : getToolApprovalConfig();

    const merged = mergeToolApprovalConfigUpdates(base, updates);

    await collection.updateOne(
        { tenantId: tid },
        {
            $set: { ...merged, tenantId: tid, updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
    );

    return merged;
}
