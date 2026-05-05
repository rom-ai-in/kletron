// Mongo-backed service for workspace connectors:
//   - Primary: account-level integrations + MCP (ownerId) with per-workspace bindings
//   - Legacy: workspace_integrations / workspace_mcp_servers (read until migrated)

import { ObjectId } from "mongodb";
import { getDatabase } from "../lib/db";
import {
    decryptJson,
    encryptJson,
    maskSecret,
    type EncryptedSecret,
} from "../lib/crypto/secrets";
import {
    isGoogleWorkspaceProviderId,
    probeGoogleWorkspaceConnection,
} from "./googleWorkspaceApi";
import { probeSentryCredentials } from "../lib/sentryApi";
import {
    connectorBindingsBulkSchema,
    connectorWorkspaceBindingsBulkSchema,
    type ConnectorBindingKind,
    type ConnectorWorkspaceBindingRow,
    integrationUpdateSchema,
    mcpServerCreateSchema,
    mcpServerUpdateSchema,
    type AccountMcpServerSummary,
    type ConnectorIntegrationStatus,
    type IntegrationCreateInput,
    type IntegrationUpdateInput,
    type McpServerCreateInput,
    type McpServerStatus,
    type McpServerTransport,
    type McpServerUpdateInput,
    type WorkspaceConnectorBinding,
    type WorkspaceIntegrationSummary,
    type WorkspaceMcpServerSummary,
} from "@kletron/shared";
import * as accountConnectors from "./accountConnectorsService";
import * as bindings from "./connectorBindingsService";
import { getWorkspaceById, getWorkspaceByIdUnsafe, listWorkspaces } from "./workspaceService";

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

async function tryWorkspaceOwnerId(workspaceId: string): Promise<string | null> {
    const w = await getWorkspaceByIdUnsafe(workspaceId);
    const id = w?.ownerId?.trim();
    return id && id.length > 0 ? id : null;
}

function bindingEnabledMap(
    bList: Awaited<ReturnType<typeof bindings.listBindingsForWorkspace>>,
    kind: "integration" | "mcp_server"
): Map<string, boolean> {
    const m = new Map<string, boolean>();
    for (const b of bList) {
        if (b.kind === kind) m.set(b.refId, b.enabled);
    }
    return m;
}

// ─── Integrations ──────────────────────────────────────────────────────────

export async function listIntegrations(workspaceId: string): Promise<WorkspaceIntegrationSummary[]> {
    await ensureIndexes();
    const out: WorkspaceIntegrationSummary[] = [];
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (ownerId) {
        const accountList = await accountConnectors.listAccountIntegrations(ownerId);
        const bMap = bindingEnabledMap(await bindings.listBindingsForWorkspace(workspaceId), "integration");
        const intCounts = await Promise.all(
            accountList.map((a) => bindings.countEnabledBindingsForRef("integration", a.id))
        );
        for (let i = 0; i < accountList.length; i++) {
            const a = accountList[i];
            out.push({
                id: a.id,
                workspaceId,
                accountIntegrationId: a.id,
                providerId: a.providerId,
                displayName: a.displayName,
                status: a.status,
                scopes: a.scopes,
                lastUsedAt: a.lastUsedAt,
                createdAt: a.createdAt,
                credentialPreview: a.credentialPreview,
                workspaceBindingEnabled: bMap.get(a.id) ?? false,
                enabledWorkspaceCount: intCounts[i],
            });
        }
    }
    const collection = await integrationsCollection();
    const docs = await collection
        .find({ workspaceId })
        .sort({ providerId: 1, createdAt: 1 })
        .toArray();
    out.push(...docs.map(toIntegrationSummary));
    return out;
}

export async function listEnabledIntegrationProviderIds(workspaceId: string): Promise<string[]> {
    await ensureIndexes();
    const ids = new Set<string>();
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (ownerId) {
        const bMap = bindingEnabledMap(await bindings.listBindingsForWorkspace(workspaceId), "integration");
        const accountList = await accountConnectors.listAccountIntegrations(ownerId);
        for (const a of accountList) {
            if (a.status !== "active") continue;
            if (bMap.get(a.id) === true) ids.add(a.providerId);
        }
    }
    const collection = await integrationsCollection();
    const docs = await collection
        .find({ workspaceId, status: "active" })
        .project<{ providerId: string }>({ providerId: 1 })
        .toArray();
    for (const d of docs) ids.add(d.providerId);
    return Array.from(ids);
}

export async function createIntegration(
    workspaceId: string,
    input: IntegrationCreateInput
): Promise<WorkspaceIntegrationSummary> {
    await ensureIndexes();
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (!ownerId) {
        throw new Error("Workspace has no owner; cannot create account integration");
    }
    const created = await accountConnectors.createAccountIntegration(ownerId, input);
    await bindings.upsertBinding(workspaceId, "integration", created.id, true);
    const enabledWorkspaceCount = await bindings.countEnabledBindingsForRef("integration", created.id);
    return {
        id: created.id,
        workspaceId,
        accountIntegrationId: created.id,
        providerId: created.providerId,
        displayName: created.displayName,
        status: created.status,
        scopes: created.scopes,
        lastUsedAt: created.lastUsedAt,
        createdAt: created.createdAt,
        credentialPreview: created.credentialPreview,
        workspaceBindingEnabled: true,
        enabledWorkspaceCount,
    };
}

export async function updateIntegration(
    workspaceId: string,
    integrationId: string,
    input: IntegrationUpdateInput
): Promise<WorkspaceIntegrationSummary | null> {
    await ensureIndexes();
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (ownerId && ObjectId.isValid(integrationId)) {
        const acc = await accountConnectors.updateAccountIntegration(ownerId, integrationId, input);
        if (acc) {
            const enabledWorkspaceCount = await bindings.countEnabledBindingsForRef("integration", acc.id);
            return {
                id: acc.id,
                workspaceId,
                accountIntegrationId: acc.id,
                providerId: acc.providerId,
                displayName: acc.displayName,
                status: acc.status,
                scopes: acc.scopes,
                lastUsedAt: acc.lastUsedAt,
                createdAt: acc.createdAt,
                credentialPreview: acc.credentialPreview,
                workspaceBindingEnabled:
                    (await bindings.getBinding(workspaceId, "integration", integrationId))?.enabled ?? false,
                enabledWorkspaceCount,
            };
        }
    }
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

/** Workspace UI: detach an account integration from this workspace (library entry remains). */
export async function deleteIntegration(workspaceId: string, integrationId: string): Promise<boolean> {
    await ensureIndexes();
    if (!ObjectId.isValid(integrationId)) return false;
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (ownerId) {
        const acc = await accountConnectors.listAccountIntegrations(ownerId);
        if (acc.some((a) => a.id === integrationId)) {
            await bindings.deleteBinding(workspaceId, "integration", integrationId);
            return true;
        }
    }
    const collection = await integrationsCollection();
    const result = await collection.deleteOne({
        _id: new ObjectId(integrationId),
        workspaceId,
    });
    return (result.deletedCount ?? 0) > 0;
}

/** Remove an account integration and all workspace bindings (account settings API). */
export async function deleteAccountIntegrationForUser(ownerId: string, integrationId: string): Promise<boolean> {
    await ensureIndexes();
    if (!ObjectId.isValid(integrationId)) return false;
    const acc = await accountConnectors.listAccountIntegrations(ownerId);
    if (!acc.some((a) => a.id === integrationId)) return false;
    await bindings.deleteAllBindingsForIntegrationRef(integrationId);
    return accountConnectors.deleteAccountIntegration(ownerId, integrationId);
}

/** Decrypt an integration's credentials. Used by tool runtime; not exposed via HTTP. */
export async function getIntegrationCredentials(
    workspaceId: string,
    integrationId: string
): Promise<Record<string, string> | null> {
    await ensureIndexes();
    if (!ObjectId.isValid(integrationId)) return null;
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (ownerId) {
        const b = await bindings.getBinding(workspaceId, "integration", integrationId);
        if (b?.enabled) {
            const creds = await accountConnectors.getAccountIntegrationCredentials(ownerId, integrationId);
            if (creds) return creds;
        }
    }
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
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (ownerId) {
        const acc = await accountConnectors.findActiveAccountIntegration(ownerId, providerId);
        if (acc) {
            const b = await bindings.getBinding(workspaceId, "integration", acc.id);
            if (b?.enabled) {
                return {
                    id: acc.id,
                    workspaceId,
                    accountIntegrationId: acc.id,
                    providerId: acc.providerId,
                    displayName: acc.displayName,
                    status: acc.status,
                    scopes: acc.scopes,
                    lastUsedAt: acc.lastUsedAt,
                    createdAt: acc.createdAt,
                    credentialPreview: acc.credentialPreview,
                    workspaceBindingEnabled: true,
                };
            }
        }
    }
    const collection = await integrationsCollection();
    const doc = await collection.findOne({ workspaceId, providerId, status: "active" });
    return doc ? toIntegrationSummary(doc) : null;
}

/** Stub: ping the provider to confirm the credentials still work. */
export async function testIntegration(
    workspaceId: string,
    integrationId: string
): Promise<{ ok: boolean; message: string }> {
    await ensureIndexes();
    if (!ObjectId.isValid(integrationId)) {
        return { ok: false, message: "Invalid integration id" };
    }
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    let providerId: string | null = null;
    if (ownerId) {
        const accList = await accountConnectors.listAccountIntegrations(ownerId);
        const hit = accList.find((a) => a.id === integrationId);
        if (hit) providerId = hit.providerId;
    }
    const collection = await integrationsCollection();
    const doc =
        providerId !== null
            ? { providerId }
            : await collection.findOne(
                  { _id: new ObjectId(integrationId), workspaceId },
                  { projection: { providerId: 1 } }
              );
    if (!doc) return { ok: false, message: "Integration not found" };

    const creds = await getIntegrationCredentials(workspaceId, integrationId);
    if (!creds) return { ok: false, message: "Integration credentials are unreadable" };

    if (isGoogleWorkspaceProviderId(doc.providerId)) {
        return await probeGoogleWorkspaceConnection(doc.providerId, creds);
    }

    if (doc.providerId === "sentry") {
        return probeSentryCredentials(creds);
    }

    // Fallback for non-Google integrations: confirm decryption succeeded.
    return { ok: true, message: "Credentials decrypted successfully" };
}

// ─── MCP servers ───────────────────────────────────────────────────────────

function accountMcpToWorkspaceSummary(
    s: AccountMcpServerSummary,
    workspaceId: string,
    bindingEnabled: boolean,
    enabledWorkspaceCount?: number
): WorkspaceMcpServerSummary {
    return {
        id: s.id,
        workspaceId,
        accountServerId: s.id,
        name: s.name,
        slug: s.slug,
        transport: s.transport,
        enabled: bindingEnabled,
        status: s.status,
        statusMessage: s.statusMessage,
        command: s.command,
        args: s.args,
        env: s.env,
        url: s.url,
        headers: s.headers,
        discoveredTools: s.discoveredTools,
        lastConnectedAt: s.lastConnectedAt,
        createdAt: s.createdAt,
        enabledWorkspaceCount,
    };
}

export async function listMcpServers(workspaceId: string): Promise<WorkspaceMcpServerSummary[]> {
    await ensureIndexes();
    const out: WorkspaceMcpServerSummary[] = [];
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (ownerId) {
        const accountList = await accountConnectors.listAccountMcpServers(ownerId);
        const bMap = bindingEnabledMap(await bindings.listBindingsForWorkspace(workspaceId), "mcp_server");
        const mcpCounts = await Promise.all(
            accountList.map((s) => bindings.countEnabledBindingsForRef("mcp_server", s.id))
        );
        for (let i = 0; i < accountList.length; i++) {
            const s = accountList[i];
            const enabled = bMap.get(s.id) ?? false;
            out.push(accountMcpToWorkspaceSummary(s, workspaceId, enabled, mcpCounts[i]));
        }
    }
    const collection = await mcpServersCollection();
    const docs = await collection.find({ workspaceId }).sort({ createdAt: 1 }).toArray();
    out.push(...docs.map(toMcpServerSummary));
    return out;
}

export async function listEnabledMcpServers(workspaceId: string): Promise<WorkspaceMcpServerSummary[]> {
    const all = await listMcpServers(workspaceId);
    return all.filter((s) => s.enabled);
}

export async function createMcpServer(
    workspaceId: string,
    input: McpServerCreateInput
): Promise<WorkspaceMcpServerSummary> {
    await ensureIndexes();
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (!ownerId) {
        throw new Error("Workspace has no owner; cannot create MCP server");
    }
    const validated = mcpServerCreateSchema.parse(input);
    const created = await accountConnectors.createAccountMcpServer(ownerId, validated);
    const bindingOn = validated.enabled ?? true;
    await bindings.upsertBinding(workspaceId, "mcp_server", created.id, bindingOn);
    const enabledWorkspaceCount = await bindings.countEnabledBindingsForRef("mcp_server", created.id);
    return accountMcpToWorkspaceSummary(created, workspaceId, bindingOn, enabledWorkspaceCount);
}

export async function updateMcpServer(
    workspaceId: string,
    serverId: string,
    input: McpServerUpdateInput
): Promise<WorkspaceMcpServerSummary | null> {
    await ensureIndexes();
    if (!ObjectId.isValid(serverId)) return null;
    const validated = mcpServerUpdateSchema.parse(input);
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (ownerId) {
        const existingAcc = await accountConnectors.getAccountMcpServer(ownerId, serverId);
        if (existingAcc) {
            const updated = await accountConnectors.updateAccountMcpServer(ownerId, serverId, {
                name: validated.name,
                transport: validated.transport,
                command: validated.command,
                args: validated.args,
                env: validated.env,
                url: validated.url,
                headers: validated.headers,
            });
            if (validated.enabled !== undefined) {
                await bindings.upsertBinding(workspaceId, "mcp_server", serverId, validated.enabled);
            }
            if (!updated) return null;
            const b = await bindings.getBinding(workspaceId, "mcp_server", serverId);
            const enabledWorkspaceCount = await bindings.countEnabledBindingsForRef("mcp_server", serverId);
            return accountMcpToWorkspaceSummary(updated, workspaceId, b?.enabled ?? false, enabledWorkspaceCount);
        }
    }
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

    await collection.updateOne({ _id: existing._id }, { $set: update });
    const fresh = await collection.findOne({ _id: existing._id });
    return fresh ? toMcpServerSummary(fresh) : null;
}

export async function deleteMcpServer(workspaceId: string, serverId: string): Promise<boolean> {
    await ensureIndexes();
    if (!ObjectId.isValid(serverId)) return false;
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (ownerId) {
        const acc = await accountConnectors.getAccountMcpServer(ownerId, serverId);
        if (acc) {
            await bindings.deleteBinding(workspaceId, "mcp_server", serverId);
            const n = await bindings.countBindingsForMcpRef(serverId);
            if (n === 0) {
                await accountConnectors.deleteAccountMcpServer(ownerId, serverId);
            }
            return true;
        }
    }
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
    const ownerId = await tryWorkspaceOwnerId(workspaceId);
    if (ownerId) {
        const acc = await accountConnectors.getAccountMcpServer(ownerId, serverId);
        if (acc) {
            await accountConnectors.recordAccountMcpServerStatus(ownerId, serverId, update);
            return;
        }
    }
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

export async function listConnectorWorkspaceBindingsForOwner(
    ownerId: string,
    kind: ConnectorBindingKind,
    refId: string
): Promise<ConnectorWorkspaceBindingRow[]> {
    if (kind === "mcp_server") {
        const s = await accountConnectors.getAccountMcpServer(ownerId, refId);
        if (!s) throw new Error("MCP server not found");
    } else {
        const list = await accountConnectors.listAccountIntegrations(ownerId);
        if (!list.some((i) => i.id === refId)) throw new Error("Integration not found");
    }

    const workspaces = await listWorkspaces(ownerId);
    const bindingRows = await bindings.listBindingsByRef(kind, refId);
    const byWs = new Map(bindingRows.map((b) => [b.workspaceId, b.enabled]));

    return workspaces.map((w) => {
        const wid = w._id?.toString() ?? "";
        return {
            workspaceId: wid,
            workspaceName: w.name,
            enabled: byWs.get(wid) ?? false,
        };
    });
}

export async function applyConnectorWorkspaceBindingsBulk(
    ownerId: string,
    kind: ConnectorBindingKind,
    refId: string,
    body: unknown
): Promise<void> {
    const parsed = connectorWorkspaceBindingsBulkSchema.parse(body);
    if (kind === "mcp_server") {
        const s = await accountConnectors.getAccountMcpServer(ownerId, refId);
        if (!s) throw new Error("MCP server not found");
    } else {
        const list = await accountConnectors.listAccountIntegrations(ownerId);
        if (!list.some((i) => i.id === refId)) throw new Error("Integration not found");
    }

    const ownedIds = new Set(
        (await listWorkspaces(ownerId))
            .map((w) => w._id?.toString())
            .filter((id): id is string => Boolean(id))
    );
    for (const row of parsed.workspaces) {
        if (!ownedIds.has(row.workspaceId)) {
            throw new Error(`Workspace not allowed: ${row.workspaceId}`);
        }
        await bindings.upsertBinding(row.workspaceId, kind, refId, row.enabled);
    }
}

/** Apply per-workspace enable/disable for account-level connectors (validated). */
export async function applyConnectorBindings(workspaceId: string, userId: string, body: unknown): Promise<void> {
    const parsed = connectorBindingsBulkSchema.parse(body);
    const ws = await getWorkspaceById(workspaceId, userId);
    if (!ws) throw new Error("Workspace not found");
    if (ws.ownerId !== userId) throw new Error("Forbidden");

    for (const b of parsed.bindings) {
        if (b.kind === "mcp_server") {
            const s = await accountConnectors.getAccountMcpServer(userId, b.refId);
            if (!s) throw new Error(`Unknown MCP server: ${b.refId}`);
        } else {
            const list = await accountConnectors.listAccountIntegrations(userId);
            if (!list.some((i) => i.id === b.refId)) {
                throw new Error(`Unknown integration: ${b.refId}`);
            }
        }
        await bindings.upsertBinding(workspaceId, b.kind, b.refId, b.enabled);
    }
}

export async function listConnectorBindingsForWorkspace(
    workspaceId: string,
    userId: string
): Promise<WorkspaceConnectorBinding[]> {
    const ws = await getWorkspaceById(workspaceId, userId);
    if (!ws) throw new Error("Workspace not found");
    if (ws.ownerId !== userId) throw new Error("Forbidden");
    return bindings.listBindingsForWorkspace(workspaceId);
}
