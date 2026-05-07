// Account-level (ownerId) MCP servers and SaaS integrations.

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
} from "@kletron/shared";
import type {
    AccountIntegrationSummary,
    AccountMcpServerSummary,
    IntegrationCreateInput,
    IntegrationUpdateInput,
    McpServerCreateInput,
    McpServerStatus,
    McpServerTransport,
    McpServerUpdateInput,
} from "@kletron/shared";

const ACCOUNT_INTEGRATIONS = "account_integrations";
const ACCOUNT_MCP_SERVERS = "account_mcp_servers";

interface AccountIntegrationDoc {
    _id?: ObjectId;
    ownerId: string;
    providerId: string;
    displayName: string;
    credentials: EncryptedSecret;
    credentialPreview: Record<string, string>;
    scopes: string[];
    status: "active" | "revoked" | "error";
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

interface AccountMcpServerDoc {
    _id?: ObjectId;
    ownerId: string;
    name: string;
    slug: string;
    transport: McpServerTransport;
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

async function integrationsColl() {
    const db = await getDatabase();
    return db.collection<AccountIntegrationDoc>(ACCOUNT_INTEGRATIONS);
}

async function mcpColl() {
    const db = await getDatabase();
    return db.collection<AccountMcpServerDoc>(ACCOUNT_MCP_SERVERS);
}

let indexesEnsured = false;
async function ensureAccountIndexes() {
    if (indexesEnsured) return;
    indexesEnsured = true;
    try {
        const i = await integrationsColl();
        await i.createIndex({ ownerId: 1, providerId: 1 });
        const m = await mcpColl();
        await m.createIndex({ ownerId: 1, slug: 1 }, { unique: true });
    } catch (e) {
        console.warn("[accountConnectorsService] ensureAccountIndexes:", (e as Error).message);
    }
}

function buildPreview(credentials: Record<string, string>): Record<string, string> {
    const preview: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
        preview[key] = maskSecret(value);
    }
    return preview;
}

function slugify(name: string): string {
    const base = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    return base || `mcp-${Date.now().toString(36)}`;
}

async function ensureUniqueAccountSlug(ownerId: string, base: string, ignoreId?: ObjectId): Promise<string> {
    const collection = await mcpColl();
    let candidate = base;
    let n = 1;
    while (true) {
        const existing = await collection.findOne({ ownerId, slug: candidate });
        if (!existing || (ignoreId && existing._id?.equals(ignoreId))) return candidate;
        n += 1;
        candidate = `${base}-${n}`;
    }
}

function safeDecryptObject(payload: EncryptedSecret): Record<string, string> | undefined {
    try {
        return decryptJson<Record<string, string>>(payload);
    } catch (error) {
        console.warn("[accountConnectorsService] decrypt failed:", (error as Error).message);
        return undefined;
    }
}

function toAccountMcpSummary(doc: AccountMcpServerDoc): AccountMcpServerSummary {
    return {
        id: doc._id?.toString() ?? "",
        ownerId: doc.ownerId,
        name: doc.name,
        slug: doc.slug,
        transport: doc.transport,
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

function toAccountIntegrationSummary(doc: AccountIntegrationDoc): AccountIntegrationSummary {
    return {
        id: doc._id?.toString() ?? "",
        ownerId: doc.ownerId,
        providerId: doc.providerId,
        displayName: doc.displayName,
        status: doc.status,
        scopes: doc.scopes ?? [],
        lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
        createdAt: doc.createdAt.toISOString(),
        credentialPreview: doc.credentialPreview ?? {},
    };
}

// ─── MCP ─────────────────────────────────────────────────────────────────────

export async function listAccountMcpServers(ownerId: string): Promise<AccountMcpServerSummary[]> {
    await ensureAccountIndexes();
    const c = await mcpColl();
    const docs = await c.find({ ownerId }).sort({ createdAt: 1 }).toArray();
    return docs.map(toAccountMcpSummary);
}

export async function getAccountMcpServer(ownerId: string, serverId: string): Promise<AccountMcpServerSummary | null> {
    await ensureAccountIndexes();
    if (!ObjectId.isValid(serverId)) return null;
    const c = await mcpColl();
    const doc = await c.findOne({ _id: new ObjectId(serverId), ownerId });
    return doc ? toAccountMcpSummary(doc) : null;
}

export async function createAccountMcpServer(
    ownerId: string,
    input: McpServerCreateInput
): Promise<AccountMcpServerSummary> {
    await ensureAccountIndexes();
    const validated = mcpServerCreateSchema.parse(input);
    const c = await mcpColl();
    const slug = await ensureUniqueAccountSlug(ownerId, slugify(validated.name));
    const now = new Date();
    const doc: AccountMcpServerDoc = {
        ownerId,
        name: validated.name,
        slug,
        transport: validated.transport,
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
    const result = await c.insertOne(doc);
    doc._id = result.insertedId;
    return toAccountMcpSummary(doc);
}

export async function updateAccountMcpServer(
    ownerId: string,
    serverId: string,
    input: McpServerUpdateInput
): Promise<AccountMcpServerSummary | null> {
    await ensureAccountIndexes();
    if (!ObjectId.isValid(serverId)) return null;
    const validated = mcpServerUpdateSchema.parse(input);
    const c = await mcpColl();
    const existing = await c.findOne({ _id: new ObjectId(serverId), ownerId });
    if (!existing) return null;

    const update: Partial<AccountMcpServerDoc> = { updatedAt: new Date() };
    if (validated.name !== undefined) {
        update.name = validated.name;
        const newSlug = slugify(validated.name);
        if (newSlug !== existing.slug) {
            update.slug = await ensureUniqueAccountSlug(ownerId, newSlug, existing._id!);
        }
    }
    if (validated.transport !== undefined) update.transport = validated.transport;
    if (validated.command !== undefined) update.command = validated.command;
    if (validated.args !== undefined) update.args = validated.args;
    if (validated.env !== undefined) {
        update.envEncrypted = validated.env ? encryptJson(validated.env) : undefined;
    }
    if (validated.url !== undefined) update.url = validated.url;
    if (validated.headers !== undefined) {
        update.headersEncrypted = validated.headers ? encryptJson(validated.headers) : undefined;
    }

    await c.updateOne({ _id: existing._id }, { $set: update });
    const fresh = await c.findOne({ _id: existing._id });
    return fresh ? toAccountMcpSummary(fresh) : null;
}

export async function deleteAccountMcpServer(ownerId: string, serverId: string): Promise<boolean> {
    await ensureAccountIndexes();
    if (!ObjectId.isValid(serverId)) return false;
    const c = await mcpColl();
    const r = await c.deleteOne({ _id: new ObjectId(serverId), ownerId });
    return (r.deletedCount ?? 0) > 0;
}

export async function recordAccountMcpServerStatus(
    ownerId: string,
    serverId: string,
    update: {
        status: McpServerStatus;
        statusMessage?: string;
        discoveredTools?: Array<{ name: string; description?: string }>;
    }
): Promise<void> {
    if (!ObjectId.isValid(serverId)) return;
    const c = await mcpColl();
    const set: Partial<AccountMcpServerDoc> = {
        status: update.status,
        statusMessage: update.statusMessage,
        updatedAt: new Date(),
    };
    if (update.discoveredTools) set.discoveredTools = update.discoveredTools;
    if (update.status === "connected") set.lastConnectedAt = new Date();
    await c.updateOne({ _id: new ObjectId(serverId), ownerId }, { $set: set });
}

// ─── Integrations ───────────────────────────────────────────────────────────

export async function listAccountIntegrations(ownerId: string): Promise<AccountIntegrationSummary[]> {
    await ensureAccountIndexes();
    const c = await integrationsColl();
    const docs = await c.find({ ownerId }).sort({ providerId: 1, createdAt: 1 }).toArray();
    return docs.map(toAccountIntegrationSummary);
}

export async function createAccountIntegration(
    ownerId: string,
    input: IntegrationCreateInput
): Promise<AccountIntegrationSummary> {
    await ensureAccountIndexes();
    const validated = integrationCreateSchema.parse(input);
    const def = getConnectorType(validated.providerId);
    if (!def) throw new Error(`Unknown connector type: ${validated.providerId}`);
    if (def.auth !== "oauth") {
        for (const field of def.credentialFields ?? []) {
            if (field.required && !validated.credentials[field.key]) {
                throw new Error(`Missing required credential: ${field.label}`);
            }
        }
    }
    const c = await integrationsColl();
    const now = new Date();

    /**
     * Google often omits `refresh_token` on re-consent; we merge the previous refresh for Calendar/Drive.
     * For **Gmail**, never merge: a legacy refresh without mailbox scopes causes ACCESS_TOKEN_SCOPE_INSUFFICIENT
     * forever (Codex MCP refreshes from it). Gmail reconnect must rely on the new token response only —
     * use stored access_token via {@link resolveGoogleHostedGmailMcpBearer} until Google returns a new refresh.
     */
    let preservedGoogleRefreshToken: string | undefined;
    if (
        def.auth === "oauth" &&
        (validated.providerId === "google-calendar" || validated.providerId === "google-drive")
    ) {
        const prevActive = await c.findOne(
            { ownerId, providerId: validated.providerId, status: "active" },
            { sort: { updatedAt: -1, createdAt: -1, _id: -1 } }
        );
        if (prevActive) {
            try {
                const prevCreds = decryptJson<Record<string, string>>(prevActive.credentials);
                const rt = typeof prevCreds.refreshToken === "string" ? prevCreds.refreshToken.trim() : "";
                if (rt) preservedGoogleRefreshToken = rt;
            } catch {
                /* ignore */
            }
        }
    }

    await c.updateMany(
        { ownerId, providerId: validated.providerId, status: "active" },
        { $set: { status: "revoked", updatedAt: now } }
    );

    const credentials: Record<string, string> = { ...validated.credentials };
    const newRt = typeof credentials.refreshToken === "string" ? credentials.refreshToken.trim() : "";
    if (!newRt && preservedGoogleRefreshToken) {
        credentials.refreshToken = preservedGoogleRefreshToken;
    }

    const doc: AccountIntegrationDoc = {
        ownerId,
        providerId: validated.providerId,
        displayName: validated.displayName?.trim() || def.name,
        credentials: encryptJson(credentials),
        credentialPreview: buildPreview(credentials),
        scopes: validated.scopes ?? def.oauthScopes ?? [],
        status: "active",
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
    };
    const result = await c.insertOne(doc);
    doc._id = result.insertedId;
    return toAccountIntegrationSummary(doc);
}

export async function updateAccountIntegration(
    ownerId: string,
    integrationId: string,
    input: IntegrationUpdateInput
): Promise<AccountIntegrationSummary | null> {
    await ensureAccountIndexes();
    const validated = integrationUpdateSchema.parse(input);
    if (!ObjectId.isValid(integrationId)) return null;
    const c = await integrationsColl();
    const existing = await c.findOne({ _id: new ObjectId(integrationId), ownerId });
    if (!existing) return null;
    const update: Partial<AccountIntegrationDoc> = { updatedAt: new Date() };
    if (validated.displayName !== undefined) update.displayName = validated.displayName;
    if (validated.status !== undefined) update.status = validated.status;
    if (validated.credentials !== undefined) {
        update.credentials = encryptJson(validated.credentials);
        update.credentialPreview = buildPreview(validated.credentials);
    }
    await c.updateOne({ _id: existing._id }, { $set: update });
    const fresh = await c.findOne({ _id: existing._id });
    return fresh ? toAccountIntegrationSummary(fresh) : null;
}

export async function deleteAccountIntegration(ownerId: string, integrationId: string): Promise<boolean> {
    await ensureAccountIndexes();
    if (!ObjectId.isValid(integrationId)) return false;
    const c = await integrationsColl();
    const r = await c.deleteOne({ _id: new ObjectId(integrationId), ownerId });
    return (r.deletedCount ?? 0) > 0;
}

export async function getAccountIntegrationCredentials(
    ownerId: string,
    integrationId: string
): Promise<Record<string, string> | null> {
    await ensureAccountIndexes();
    if (!ObjectId.isValid(integrationId)) return null;
    const c = await integrationsColl();
    const doc = await c.findOne({ _id: new ObjectId(integrationId), ownerId });
    if (!doc) return null;
    try {
        return decryptJson<Record<string, string>>(doc.credentials);
    } catch (error) {
        console.warn("[accountConnectorsService] decrypt failed:", (error as Error).message);
        return null;
    }
}

export async function findActiveAccountIntegration(
    ownerId: string,
    providerId: string
): Promise<AccountIntegrationSummary | null> {
    await ensureAccountIndexes();
    const c = await integrationsColl();
    const doc = await c.findOne(
        { ownerId, providerId, status: "active" },
        { sort: { updatedAt: -1, createdAt: -1, _id: -1 } }
    );
    return doc ? toAccountIntegrationSummary(doc) : null;
}
