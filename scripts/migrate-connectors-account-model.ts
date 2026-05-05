/**
 * One-time migration: copy legacy `workspace_mcp_servers` and `workspace_integrations`
 * into `account_mcp_servers`, `account_integrations`, and `workspace_connector_bindings`.
 *
 * Idempotent via `migratedFromWorkspaceMcpId` / `migratedFromWorkspaceIntegrationId` on account docs.
 *
 * Usage (repo root, with MONGODB_URI in .env):
 *   npx tsx scripts/migrate-connectors-account-model.ts
 *
 * Optional: CONNECTORS_MIGRATE_DRY_RUN=1 — log actions only.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import type { Collection, Document } from "mongodb";
import { ObjectId } from "mongodb";
import { getDb, closeDb } from "@kletron/server/lib/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config({ path: path.join(ROOT, ".env") });
dotenv.config();

const DRY = process.env.CONNECTORS_MIGRATE_DRY_RUN === "1";

const WORKSPACE_MCP = "workspace_mcp_servers";
const WORKSPACE_INT = "workspace_integrations";
const ACCOUNT_MCP = "account_mcp_servers";
const ACCOUNT_INT = "account_integrations";
const BINDINGS = "workspace_connector_bindings";
const WORKSPACES = "workspaces";

async function uniqueAccountMcpSlug(
    coll: Collection<Document>,
    ownerId: string,
    base: string
): Promise<string> {
    let candidate = base.slice(0, 48) || `mcp-${Date.now().toString(36)}`;
    let n = 1;
    for (;;) {
        const hit = await coll.findOne({ ownerId, slug: candidate });
        if (!hit) return candidate;
        n += 1;
        candidate = `${base}-${n}`.slice(0, 56);
    }
}

async function main() {
    const db = await getDb();
    const wsCol = db.collection(WORKSPACES);
    const legacyMcp = db.collection(WORKSPACE_MCP);
    const legacyInt = db.collection(WORKSPACE_INT);
    const accMcp = db.collection(ACCOUNT_MCP);
    const accInt = db.collection(ACCOUNT_INT);
    const bind = db.collection(BINDINGS);

    try {
        await accMcp.createIndex({ ownerId: 1, slug: 1 }, { unique: true });
        await accInt.createIndex({ ownerId: 1, providerId: 1 });
        await bind.createIndex({ workspaceId: 1, kind: 1, refId: 1 }, { unique: true });
    } catch (e) {
        console.warn("[indexes]", (e as Error).message);
    }

    const workspaceOwner = new Map<string, string>();
    const wsDocs = await wsCol.find({}, { projection: { ownerId: 1 } }).toArray();
    for (const w of wsDocs) {
        const id = w._id instanceof ObjectId ? w._id.toString() : String(w._id);
        const owner = typeof w.ownerId === "string" ? w.ownerId.trim() : "";
        if (owner) workspaceOwner.set(id, owner);
    }

    let mcpMigrated = 0;
    let mcpSkipped = 0;
    for await (const doc of legacyMcp.find({})) {
        const wid = doc.workspaceId as string;
        const ownerId = workspaceOwner.get(wid);
        if (!ownerId) {
            console.warn(`[mcp] skip (no owner): workspaceId=${wid} _id=${doc._id}`);
            mcpSkipped += 1;
            continue;
        }
        const existing = await accMcp.findOne({
            ownerId,
            migratedFromWorkspaceMcpId: doc._id,
        } as Record<string, unknown>);
        if (existing) {
            mcpSkipped += 1;
            continue;
        }
        const baseSlug = (doc.slug as string) || `mcp-${String(doc._id)}`;
        const slug = await uniqueAccountMcpSlug(accMcp, ownerId, baseSlug);
        const now = new Date();
        const insertDoc = {
            ownerId,
            name: doc.name,
            slug,
            transport: doc.transport,
            status: doc.status ?? "unknown",
            statusMessage: doc.statusMessage,
            command: doc.command,
            args: doc.args,
            envEncrypted: doc.envEncrypted,
            url: doc.url,
            headersEncrypted: doc.headersEncrypted,
            discoveredTools: doc.discoveredTools ?? [],
            lastConnectedAt: doc.lastConnectedAt ?? null,
            createdAt: doc.createdAt ?? now,
            updatedAt: doc.updatedAt ?? now,
            migratedFromWorkspaceMcpId: doc._id,
        };
        if (DRY) {
            console.log("[dry-run] would migrate MCP", doc._id?.toString(), "→", slug);
            mcpMigrated += 1;
            continue;
        }
        const ins = await accMcp.insertOne(insertDoc);
        const refId = ins.insertedId;
        await bind.updateOne(
            { workspaceId: wid, kind: "mcp_server", refId },
            {
                $set: {
                    enabled: doc.enabled !== false,
                    updatedAt: now,
                },
                $setOnInsert: {
                    workspaceId: wid,
                    kind: "mcp_server",
                    refId,
                    createdAt: now,
                },
            },
            { upsert: true }
        );
        mcpMigrated += 1;
    }

    let intBindings = 0;
    let intSkipped = 0;
    const intDocs = await legacyInt.find({}).sort({ createdAt: 1 }).toArray();
    for (const doc of intDocs) {
        const wid = doc.workspaceId as string;
        const ownerId = workspaceOwner.get(wid);
        if (!ownerId) {
            console.warn(`[int] skip (no owner): workspaceId=${wid} _id=${doc._id}`);
            intSkipped += 1;
            continue;
        }
        const already = await accInt.findOne({
            ownerId,
            migratedFromWorkspaceIntegrationId: doc._id,
        } as Record<string, unknown>);
        if (already) {
            intSkipped += 1;
            continue;
        }

        let refId: ObjectId | null = null;
        const partner = await accInt.findOne({ ownerId, providerId: doc.providerId });
        if (partner) {
            refId = partner._id!;
            console.warn(
                `[int] duplicate provider ${doc.providerId} for owner ${ownerId}: binding workspace ${wid} to account integration ${refId.toString()}`
            );
        } else {
            const now = new Date();
            const insertDoc = {
                ownerId,
                providerId: doc.providerId,
                displayName: doc.displayName,
                credentials: doc.credentials,
                credentialPreview: doc.credentialPreview ?? {},
                scopes: doc.scopes ?? [],
                status: doc.status ?? "active",
                lastUsedAt: doc.lastUsedAt ?? null,
                createdAt: doc.createdAt ?? now,
                updatedAt: doc.updatedAt ?? now,
                migratedFromWorkspaceIntegrationId: doc._id,
            };
            if (DRY) {
                console.log("[dry-run] would insert account integration", doc._id?.toString(), doc.providerId);
            } else {
                const ins = await accInt.insertOne(insertDoc);
                refId = ins.insertedId;
            }
        }

        if (DRY) {
            console.log("[dry-run] would upsert integration binding", wid, doc.providerId);
            intBindings += 1;
            continue;
        }

        if (!refId) {
            console.warn(`[int] missing refId for ${doc._id?.toString()}`);
            continue;
        }

        const now = new Date();
        await bind.updateOne(
            { workspaceId: wid, kind: "integration", refId },
            {
                $set: {
                    enabled: doc.status === "active",
                    updatedAt: now,
                },
                $setOnInsert: {
                    workspaceId: wid,
                    kind: "integration",
                    refId,
                    createdAt: now,
                },
            },
            { upsert: true }
        );
        intBindings += 1;
    }

    console.log(
        `Done. MCP migrated=${mcpMigrated} skipped=${mcpSkipped}; integration bindings upserted=${intBindings} skipped=${intSkipped}. DryRun=${DRY}`
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => closeDb());
