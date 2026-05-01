// Tiny HTTP client used by the MCP server to ask the web API for the
// resolved capabilities of a workspace.
//
// Falls back to .kletron/*.json files if the web API is not reachable
// (offline / desktop-only mode).

import path from "path";
import fs from "fs";

const DEFAULT_BASE_URL = process.env.KLETRON_WEB_BASE_URL || "http://127.0.0.1:3000";

/**
 * Find the workspace ObjectId for a given root path by reading the
 * config/config.json mirror. The web `syncConfigJson` keeps these in sync.
 *
 * Returns null if it can't be resolved (we'll fall back to file mode).
 */
export async function resolveWorkspaceIdFromRoot(workspaceRoot) {
    if (!workspaceRoot) return null;
    const normalized = path.normalize(workspaceRoot);
    const baseUrl = (process.env.KLETRON_WEB_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    const internalToken = process.env.MCP_INTERNAL_TOKEN || process.env.KLETRON_INTERNAL_TOKEN;
    if (!internalToken) return null;
    try {
        const res = await fetch(`${baseUrl}/api/workspaces/by-path?path=${encodeURIComponent(normalized)}`, {
            headers: {
                "x-mcp-internal-token": internalToken,
            },
        });
        if (!res.ok) return null;
        const json = await res.json();
        return typeof json?.workspaceId === "string" ? json.workspaceId : null;
    } catch {
        return null;
    }
}

/**
 * Fetch resolved capabilities for a workspace via the web API.
 * Returns null if unreachable or unauthenticated.
 */
export async function fetchCapabilities(workspaceId, ownerId) {
    if (!workspaceId) return null;
    const baseUrl = (process.env.KLETRON_WEB_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    const internalToken = process.env.MCP_INTERNAL_TOKEN || process.env.KLETRON_INTERNAL_TOKEN;
    if (!internalToken) return null;
    try {
        const res = await fetch(`${baseUrl}/api/workspaces/${workspaceId}/capabilities`, {
            headers: {
                "x-mcp-internal-token": internalToken,
                ...(ownerId ? { "x-on-behalf-of": ownerId } : {}),
            },
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

/**
 * Local fallback: read .kletron/skills.json and .kletron/connectors.json from
 * the workspace root and synthesize a capability shape that the rest of the
 * MCP server can consume identically.
 */
export function readLocalCapabilities(workspaceRoot) {
    if (!workspaceRoot) {
        return { enabledTools: [], enabledSkills: [], enabledIntegrationProviderIds: [], externalMcpServers: [] };
    }
    const enabledSkills = [];
    const enabledIntegrationProviderIds = [];
    const externalMcpServers = [];

    const skillsPath = path.join(workspaceRoot, ".kletron", "skills.json");
    if (fs.existsSync(skillsPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(skillsPath, "utf-8"));
            if (Array.isArray(data?.skills)) {
                for (const slug of data.skills) {
                    enabledSkills.push({
                        slug,
                        name: slug,
                        version: "1.0.0",
                        description: "",
                        tags: [],
                        requiredTools: [],
                        suggestedTools: [],
                        extends: [],
                        body: "",
                        source: "builtin",
                        resolvedSystemPrompt: "",
                        resolvedTools: [],
                        extendsChain: [slug],
                        createdAt: new Date(0).toISOString(),
                        updatedAt: new Date(0).toISOString(),
                    });
                }
            }
        } catch (err) {
            console.warn("[capabilityClient] Failed to read skills.json:", err.message);
        }
    }

    const connectorsPath = path.join(workspaceRoot, ".kletron", "connectors.json");
    if (fs.existsSync(connectorsPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(connectorsPath, "utf-8"));
            if (Array.isArray(data)) {
                for (const conn of data) {
                    if (conn?.type) enabledIntegrationProviderIds.push(conn.type);
                    if (conn?.transport) {
                        externalMcpServers.push({
                            id: conn.id ?? `local_${Date.now()}`,
                            slug: conn.slug ?? conn.id ?? "external",
                            name: conn.name ?? "External",
                            transport: conn.transport,
                            command: conn.command,
                            args: conn.args,
                            env: conn.env,
                            url: conn.url,
                            headers: conn.headers,
                        });
                    }
                }
            }
        } catch (err) {
            console.warn("[capabilityClient] Failed to read connectors.json:", err.message);
        }
    }

    return {
        workspaceId: null,
        enabledSkills,
        enabledTools: [],
        enabledIntegrationProviderIds,
        externalMcpServers,
    };
}
