// Per-workspace enablement for account-level connectors.

import { ObjectId } from "mongodb";
import { getDatabase } from "../lib/db";
import type { ConnectorBindingKind, WorkspaceConnectorBinding } from "@kletron/shared";

const COLLECTION = "workspace_connector_bindings";

export interface ConnectorBindingDoc {
    _id?: ObjectId;
    workspaceId: string;
    kind: ConnectorBindingKind;
    refId: ObjectId;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

function toSummary(doc: ConnectorBindingDoc): WorkspaceConnectorBinding {
    return {
        id: doc._id?.toString() ?? "",
        workspaceId: doc.workspaceId,
        kind: doc.kind,
        refId: doc.refId.toString(),
        enabled: doc.enabled,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}

async function collection() {
    const db = await getDatabase();
    return db.collection<ConnectorBindingDoc>(COLLECTION);
}

let indexesEnsured = false;
async function ensureIndexes() {
    if (indexesEnsured) return;
    indexesEnsured = true;
    try {
        const c = await collection();
        await c.createIndex({ workspaceId: 1, kind: 1, refId: 1 }, { unique: true });
        await c.createIndex({ workspaceId: 1, enabled: 1 });
        await c.createIndex({ kind: 1, refId: 1 });
    } catch (e) {
        console.warn("[connectorBindingsService] ensureIndexes:", (e as Error).message);
    }
}

export async function listBindingsForWorkspace(workspaceId: string): Promise<WorkspaceConnectorBinding[]> {
    await ensureIndexes();
    const c = await collection();
    const docs = await c.find({ workspaceId }).sort({ kind: 1, createdAt: 1 }).toArray();
    return docs.map(toSummary);
}

export async function listBindingsByRef(
    kind: ConnectorBindingKind,
    refId: string
): Promise<WorkspaceConnectorBinding[]> {
    await ensureIndexes();
    if (!ObjectId.isValid(refId)) return [];
    const c = await collection();
    const docs = await c.find({ kind, refId: new ObjectId(refId) }).toArray();
    return docs.map(toSummary);
}

export async function countEnabledBindingsForRef(
    kind: ConnectorBindingKind,
    refId: string
): Promise<number> {
    await ensureIndexes();
    if (!ObjectId.isValid(refId)) return 0;
    const c = await collection();
    return c.countDocuments({ kind, refId: new ObjectId(refId), enabled: true });
}

export async function getBinding(
    workspaceId: string,
    kind: ConnectorBindingKind,
    refId: string
): Promise<WorkspaceConnectorBinding | null> {
    await ensureIndexes();
    if (!ObjectId.isValid(refId)) return null;
    const c = await collection();
    const doc = await c.findOne({ workspaceId, kind, refId: new ObjectId(refId) });
    return doc ? toSummary(doc) : null;
}

export async function upsertBinding(
    workspaceId: string,
    kind: ConnectorBindingKind,
    refId: string,
    enabled: boolean
): Promise<WorkspaceConnectorBinding> {
    await ensureIndexes();
    if (!ObjectId.isValid(refId)) throw new Error("Invalid refId");
    const rid = new ObjectId(refId);
    const c = await collection();
    const now = new Date();
    await c.updateOne(
        { workspaceId, kind, refId: rid },
        {
            $set: { enabled, updatedAt: now },
            $setOnInsert: { workspaceId, kind, refId: rid, createdAt: now },
        },
        { upsert: true }
    );
    const doc = await c.findOne({ workspaceId, kind, refId: rid });
    if (!doc) throw new Error("upsertBinding failed");
    return toSummary(doc);
}

export async function deleteBinding(workspaceId: string, kind: ConnectorBindingKind, refId: string): Promise<boolean> {
    await ensureIndexes();
    if (!ObjectId.isValid(refId)) return false;
    const c = await collection();
    const r = await c.deleteOne({ workspaceId, kind, refId: new ObjectId(refId) });
    return (r.deletedCount ?? 0) > 0;
}

/** Count workspaces (any) with an enabled or disabled binding to this MCP server. */
export async function countBindingsForMcpRef(refId: string): Promise<number> {
    await ensureIndexes();
    if (!ObjectId.isValid(refId)) return 0;
    const c = await collection();
    return c.countDocuments({ kind: "mcp_server", refId: new ObjectId(refId) });
}

export async function deleteAllBindingsForMcpRef(refId: string): Promise<number> {
    await ensureIndexes();
    if (!ObjectId.isValid(refId)) return 0;
    const c = await collection();
    const r = await c.deleteMany({ kind: "mcp_server", refId: new ObjectId(refId) });
    return r.deletedCount ?? 0;
}

export async function deleteAllBindingsForIntegrationRef(refId: string): Promise<number> {
    await ensureIndexes();
    if (!ObjectId.isValid(refId)) return 0;
    const c = await collection();
    const r = await c.deleteMany({ kind: "integration", refId: new ObjectId(refId) });
    return r.deletedCount ?? 0;
}
