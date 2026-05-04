// Mongo-backed service for workspace connectors:
//   - Integrations: SaaS credentials (encrypted) per workspace
//   - MCP Servers: bring-your-own external MCP servers per workspace

import { ObjectId } from "mongodb";
import { getDatabase } from "../lib/db";
import {
    decryptJson,
    encryptJson,
    maskSecret,
    type EncryptedSecret,
} from "../lib/crypto/secrets";
import {
    getConnectorType,
    integrationCreateSchema,
    integrationUpdateSchema,
    mcpServerCreateSchema,
    mcpServerUpdateSchema,
    type ConnectorIntegrationStatus,
    type IntegrationCreateInput,
    type IntegrationUpdateInput,
    type McpServerCreateInput,
    type McpServerStatus,
    type McpServerTransport,
    type McpServerUpdateInput,
    type WorkspaceIntegrationSummary,
    type WorkspaceMcpServerSummary,
} from "@kletron/shared";

const INTEGRATIONS_COLLECTION = "workspace_integrations";
const MCP_SERVERS_COLLECTION = "workspace_mcp_servers";

interface IntegrationDoc {
    _id?: ObjectId;
    workspaceId: string;
    providerId: string;
    displayName: string;
    credentials: EncryptedSecret;
    /** Plain-text preview hints for the UI (last 4 chars etc.). Never the secret. */
    credentialPreview: Record<string, string>;
    scopes: string[];
    status: ConnectorIntegrationStatus;
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

interface McpServerDoc {
    _id?: ObjectId;
    workspaceId: string;
    name: string;
    slug: string;
    transport: McpServerTransport;
    enabled: boolean;
    status: McpServerStatus;
    statusMessage?: string;
    command?: string;
    args?: string[];
    envEncrypted?: EncryptedSecret;
    url?: string;
    headersEncrypted?: EncryptedSecret;
    discoveredTools: Array<{ name: string; description?: string }>;
    lastConnectedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

async function integrationsCollection() {
    const db = await getDatabase();
    return db.collection<IntegrationDoc>(INTEGRATIONS_COLLECTION);
}

async function mcpServersCollection() {
    const db = await getDatabase();
    return db.collection<McpServerDoc>(MCP_SERVERS_COLLECTION);
}

let indexesEnsured = false;
async function ensureIndexes() {
    if (indexesEnsured) return;
    indexesEnsured = true;
    try {
        const integrations = await integrationsCollection();
        await integrations.createIndex({ workspaceId: 1, providerId: 1 });
        const servers = await mcpServersCollection();
        await servers.createIndex({ workspaceId: 1, slug: 1 }, { unique: true });
    } catch (error) {
        console.warn("[connectorsService] ensureIndexes:", (error as Error).message);
    }
}

function buildPreview(credentials: Record<string, string>): Record<string, string> {
    const preview: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
        preview[key] = maskSecret(value);
    }
    return preview;
}

function toIntegrationSummary(doc: IntegrationDoc): WorkspaceIntegrationSummary {
    return {
        id: doc._id?.toString() ?? "",
        workspaceId: doc.workspaceId,
        providerId: doc.providerId,
        displayName: doc.displayName,
        status: doc.status,
        scopes: doc.scopes ?? [],
        lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
        createdAt: doc.createdAt.toISOString(),
        credentialPreview: doc.credentialPreview ?? {},
    };
}

function slugify(name: string): string {
    const base = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    return base || `mcp-${Date.now().toString(36)}`;
}

async function ensureUniqueSlug(workspaceId: string, base: string, ignoreId?: ObjectId): Promise<string> {
    const collection = await mcpServersCollection();
    let candidate = base;
    let n = 1;
    while (true) {
        const existing = await collection.findOne({ workspaceId, slug: candidate });
        if (!existing || (ignoreId && existing._id?.equals(ignoreId))) return candidate;
        n += 1;
        candidate = `${base}-${n}`;
    }
}

function toMcpServerSummary(doc: McpServerDoc): WorkspaceMcpServerSummary {
    return {
        id: doc._id?.toString() ?? "",
        workspaceId: doc.workspaceId,
        name: doc.name,
        slug: doc.slug,
        transport: doc.transport,
        enabled: doc.enabled,
        status: doc.status,
        statusMessage: doc.statusMessage,
        command: doc.command,
        args: doc.args,
        env: doc.envEncrypted ? safeDecryptObject(doc.envEncrypted) : undefined,
        url: doc.url,
        headers: doc.headersEncrypted ? safeDecryptObject(doc.headersEncrypted) : undefined,
        discoveredTools: doc.discoveredTools ?? [],
        lastConnectedAt: doc.lastConnectedAt ? doc.lastConnectedAt.toISOString() : null,
        createdAt: doc.createdAt.toISOString(),
    };
}

function safeDecryptObject(payload: EncryptedSecret): Record<string, string> | undefined {
    try {
        return decryptJson<Record<string, string>>(payload);
    } catch (error) {
        console.warn("[connectorsService] Failed to decrypt env/headers:", (error as Error).message);
        return undefined;
    }
}

// ─── Integrations ──────────────────────────────────────────────────────────

export async function listIntegrations(workspaceId: string): Promise<WorkspaceIntegrationSummary[]> {
    await ensureIndexes();
    const collection = await integrationsCollection();
    const docs = await collection
        .find({ workspaceId })
        .sort({ providerId: 1, createdAt: 1 })
        .toArray();
    return docs.map(toIntegrationSummary);
}

export async function listEnabledIntegrationProviderIds(workspaceId: string): Promise<string[]> {
    await ensureIndexes();
    const collection = await integrationsCollection();
    const docs = await collection
        .find({ workspaceId, status: "active" })
        .project<{ providerId: string }>({ providerId: 1 })
        .toArray();
    return Array.from(new Set(docs.map((d) => d.providerId)));
}

export async function createIntegration(
    workspaceId: string,
    input: IntegrationCreateInput
): Promise<WorkspaceIntegrationSummary> {
    await ensureIndexes();
    const validated = integrationCreateSchema.parse(input);
    const def = getConnectorType(validated.providerId);
    if (!def) {
        throw new Error(`Unknown connector type: ${validated.providerId}`);
    }

    // Validate that all required fields are present for non-OAuth providers.
    if (def.auth !== "oauth") {
        for (const field of def.credentialFields ?? []) {
            if (field.required && !validated.credentials[field.key]) {
                throw new Error(`Missing required credential: ${field.label}`);
            }
        }
    }

    const collection = await integrationsCollection();
    const now = new Date();
    const doc: IntegrationDoc = {
        workspaceId,
        providerId: validated.providerId,
        displayName: validated.displayName?.trim() || def.name,
        credentials: encryptJson(validated.credentials),
        credentialPreview: buildPreview(validated.credentials),
        scopes: validated.scopes ?? def.oauthScopes ?? [],
        status: "active",
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
    };
    const result = await collection.insertOne(doc);
    doc._id = result.insertedId;
    return toIntegrationSummary(doc);
}

export async function updateIntegration(
    workspaceId: string,
    integrationId: string,
    input: IntegrationUpdateInput
): Promise<WorkspaceIntegrationSummary | null> {
    await ensureIndexes();
    const validated = integrationUpdateSchema.parse(input);
    if (!ObjectId.isValid(integrationId)) return null;
    const collection = await integrationsCollection();
    const existing = await collection.findOne({ _id: new ObjectId(integrationId), workspaceId });
    if (!existing) return null;

    const update: Partial<IntegrationDoc> = { updatedAt: new Date() };
    if (validated.displayName !== undefined) update.displayName = validated.displayName;
    if (validated.status !== undefined) update.status = validated.status;
    if (validated.credentials !== undefined) {
        update.credentials = encryptJson(validated.credentials);
        update.credentialPreview = buildPreview(validated.credentials);
    }
    await collection.updateOne({ _id: existing._id }, { $set: update });
    const fresh = await collection.findOne({ _id: existing._id });
    return fresh ? toIntegrationSummary(fresh) : null;
}

export async function deleteIntegration(workspaceId: string, integrationId: string): Promise<boolean> {
    await ensureIndexes();
    if (!ObjectId.isValid(integrationId)) return false;
    const collection = await integrationsCollection();
    const result = await collection.deleteOne({
        _id: new ObjectId(integrationId),
        workspaceId,
    });
    return (result.deletedCount ?? 0) > 0;
}

/** Decrypt an integration's credentials. Used by tool runtime; not exposed via HTTP. */
export async function getIntegrationCredentials(
    workspaceId: string,
    integrationId: string
): Promise<Record<string, string> | null> {
    await ensureIndexes();
    if (!ObjectId.isValid(integrationId)) return null;
    const collection = await integrationsCollection();
    const doc = await collection.findOne({ _id: new ObjectId(integrationId), workspaceId });
    if (!doc) return null;
    try {
        return decryptJson<Record<string, string>>(doc.credentials);
    } catch (error) {
        console.warn("[connectorsService] decrypt failed:", (error as Error).message);
        return null;
    }
}

export async function findActiveIntegration(
    workspaceId: string,
    providerId: string
): Promise<WorkspaceIntegrationSummary | null> {
    await ensureIndexes();
    const collection = await integrationsCollection();
    const doc = await collection.findOne({ workspaceId, providerId, status: "active" });
    return doc ? toIntegrationSummary(doc) : null;
}

/** Stub: ping the provider to confirm the credentials still work. */
export async function testIntegration(
    workspaceId: string,
    integrationId: string
): Promise<{ ok: boolean; message: string }> {
    const creds = await getIntegrationCredentials(workspaceId, integrationId);
    if (!creds) return { ok: false, message: "Integration not found or credentials unreadable" };
    // The actual probe is provider-specific. For now we just confirm decryption
    // succeeded; richer probes can be added per-provider later.
    return { ok: true, message: "Credentials decrypted successfully" };
}

// ─── MCP servers ───────────────────────────────────────────────────────────

export async function listMcpServers(workspaceId: string): Promise<WorkspaceMcpServerSummary[]> {
    await ensureIndexes();
    const collection = await mcpServersCollection();
    const docs = await collection
        .find({ workspaceId })
        .sort({ createdAt: 1 })
        .toArray();
    return docs.map(toMcpServerSummary);
}

export async function listEnabledMcpServers(workspaceId: string): Promise<WorkspaceMcpServerSummary[]> {
    await ensureIndexes();
    const collection = await mcpServersCollection();
    const docs = await collection
        .find({ workspaceId, enabled: true })
        .sort({ createdAt: 1 })
        .toArray();
    return docs.map(toMcpServerSummary);
}

export async function createMcpServer(
    workspaceId: string,
    input: McpServerCreateInput
): Promise<WorkspaceMcpServerSummary> {
    await ensureIndexes();
    const validated = mcpServerCreateSchema.parse(input);
    const collection = await mcpServersCollection();
    const slug = await ensureUniqueSlug(workspaceId, slugify(validated.name));
    const now = new Date();
    const doc: McpServerDoc = {
        workspaceId,
        name: validated.name,
        slug,
        transport: validated.transport,
        enabled: validated.enabled ?? true,
        status: "unknown",
        command: validated.command,
        args: validated.args,
        envEncrypted: validated.env ? encryptJson(validated.env) : undefined,
        url: validated.url,
        headersEncrypted: validated.headers ? encryptJson(validated.headers) : undefined,
        discoveredTools: [],
        lastConnectedAt: null,
        createdAt: now,
        updatedAt: now,
    };
    const result = await collection.insertOne(doc);
    doc._id = result.insertedId;
    return toMcpServerSummary(doc);
}

export async function updateMcpServer(
    workspaceId: string,
    serverId: string,
    input: McpServerUpdateInput
): Promise<WorkspaceMcpServerSummary | null> {
    await ensureIndexes();
    if (!ObjectId.isValid(serverId)) return null;
    const validated = mcpServerUpdateSchema.parse(input);
    const collection = await mcpServersCollection();
    const existing = await collection.findOne({ _id: new ObjectId(serverId), workspaceId });
    if (!existing) return null;

    const update: Partial<McpServerDoc> = { updatedAt: new Date() };
    if (validated.name !== undefined) {
        update.name = validated.name;
        const newSlug = slugify(validated.name);
        if (newSlug !== existing.slug) {
            update.slug = await ensureUniqueSlug(workspaceId, newSlug, existing._id!);
        }
    }
    if (validated.enabled !== undefined) update.enabled = validated.enabled;
    if (validated.command !== undefined) update.command = validated.command;
    if (validated.args !== undefined) update.args = validated.args;
    if (validated.env !== undefined) {
        update.envEncrypted = validated.env ? encryptJson(validated.env) : undefined;
    }
    if (validated.url !== undefined) update.url = validated.url;
    if (validated.headers !== undefined) {
        update.headersEncrypted = validated.headers ? encryptJson(validated.headers) : undefined;
    }

    await collection.updateOne({ _id: existing._id }, { $set: update });
    const fresh = await collection.findOne({ _id: existing._id });
    return fresh ? toMcpServerSummary(fresh) : null;
}

export async function deleteMcpServer(workspaceId: string, serverId: string): Promise<boolean> {
    await ensureIndexes();
    if (!ObjectId.isValid(serverId)) return false;
    const collection = await mcpServersCollection();
    const result = await collection.deleteOne({
        _id: new ObjectId(serverId),
        workspaceId,
    });
    return (result.deletedCount ?? 0) > 0;
}

export async function recordMcpServerStatus(
    workspaceId: string,
    serverId: string,
    update: {
        status: McpServerStatus;
        statusMessage?: string;
        discoveredTools?: Array<{ name: string; description?: string }>;
    }
): Promise<void> {
    if (!ObjectId.isValid(serverId)) return;
    const collection = await mcpServersCollection();
    const set: Partial<McpServerDoc> = {
        status: update.status,
        statusMessage: update.statusMessage,
        updatedAt: new Date(),
    };
    if (update.discoveredTools) set.discoveredTools = update.discoveredTools;
    if (update.status === "connected") set.lastConnectedAt = new Date();
    await collection.updateOne(
        { _id: new ObjectId(serverId), workspaceId },
        { $set: set }
    );
}

/**
 * Build the runtime config needed by the multi-server MCP client to connect
 * to the user's enabled external servers.
 */
export interface ExternalMcpRuntimeConfig {
    id: string;
    slug: string;
    name: string;
    transport: McpServerTransport;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
}

export async function getExternalMcpRuntimeConfig(workspaceId: string): Promise<ExternalMcpRuntimeConfig[]> {
    const enabled = await listEnabledMcpServers(workspaceId);
    return enabled.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        transport: s.transport,
        command: s.command,
        args: s.args,
        env: s.env,
        url: s.url,
        headers: s.headers,
    }));
}
