// Multi-server MCP client.
//
// Wraps the bundled Kletron MCP server *and* zero or more external MCP servers
// configured per workspace (workspace_mcp_servers in Mongo). Tools from
// external servers are namespaced as `<serverSlug>__<toolName>` to avoid
// collisions and to make it obvious in the UI/agent traces which server a
// tool belongs to.

import path from "node:path";
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { EventSource } from "eventsource";

import { bundledMcpTransportOptions } from "./bundledMcpAuth";
import { createRemoteMcpTransport } from "./remoteMcpTransport";

export type McpServerTransport = "stdio" | "sse" | "streamable-http";

export interface ExternalMcpClientConfig {
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

export interface ManagedClient {
    /** Slug used as the namespace prefix. Empty string = bundled server. */
    slug: string;
    name: string;
    client: Client;
    /** Tools as last seen on this server. */
    tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    /** Connect timestamp. */
    connectedAt: Date;
    /** Last error, if disconnected. */
    error?: string;
}

export const MCP_TOOL_NAMESPACE_SEP = "__";

export function namespacedExternalToolName(serverSlug: string, toolName: string): string {
    return `${serverSlug}${MCP_TOOL_NAMESPACE_SEP}${toolName}`;
}

export function parseNamespacedToolName(fullName: string): {
    serverSlug: string | null;
    toolName: string;
} {
    const i = fullName.indexOf(MCP_TOOL_NAMESPACE_SEP);
    if (i <= 0) return { serverSlug: null, toolName: fullName };
    return {
        serverSlug: fullName.slice(0, i),
        toolName: fullName.slice(i + MCP_TOOL_NAMESPACE_SEP.length),
    };
}

/**
 * Map an LLM-emitted tool id to the server's registered name (MCP tool names are
 * case-sensitive on the wire; models often change casing).
 */
export function resolveCanonicalMcpToolName(
    tools: Array<{ name: string }>,
    requested: string
): string {
    const r = String(requested ?? "").trim();
    if (!r) return r;
    for (const t of tools) {
        if (t.name === r) return t.name;
    }
    const rl = r.toLowerCase();
    for (const t of tools) {
        if (t.name.toLowerCase() === rl) return t.name;
    }
    return r;
}

/** Resolve configured server slug when the model uses different casing. */
export function resolveExternalServerSlugKey(externalSlugs: Iterable<string>, requestedSlug: string): string | null {
    const req = String(requestedSlug ?? "").trim();
    if (!req) return null;
    // Snapshot — Map.keys() iterators are single-use; two passes would skip case-insensitive matching.
    const keys = [...externalSlugs];
    for (const k of keys) {
        if (k === req) return k;
    }
    const rl = req.toLowerCase();
    for (const k of keys) {
        if (k.toLowerCase() === rl) return k;
    }
    return null;
}

function buildClient() {
    return new Client(
        { name: "kletron-mcp-client", version: "1.0.0" },
        { capabilities: {} }
    );
}

function buildTransport(config: ExternalMcpClientConfig | { slug: ""; transport: "stdio" | "sse" }) {
    if (config.transport === "stdio") {
        const stdio = config as ExternalMcpClientConfig;
        if (!stdio.command) throw new Error(`stdio MCP server '${stdio.slug}' missing command`);
        return new StdioClientTransport({
            command: stdio.command,
            args: stdio.args ?? [],
            env: { ...process.env, ...(stdio.env ?? {}) } as Record<string, string>,
        });
    }
    const httpish = config as ExternalMcpClientConfig;
    if (!httpish.url) throw new Error(`MCP server '${httpish.slug}' missing url`);
    const wire: "sse" | "streamable-http" =
        httpish.transport === "streamable-http" ? "streamable-http" : "sse";
    return createRemoteMcpTransport({
        transport: wire,
        url: httpish.url,
        headers: httpish.headers,
    });
}

/**
 * Standalone multi-server MCP helper with a **single global** external connection map.
 *
 * **Do not use for Kletron agent or workspace connectors** — use `McpClient`
 * (`@kletron/mcp-client/client`) instead: it isolates external MCP sessions per
 * workspace and matches `syncWorkspaceExternalMcpServers` / approval replay semantics.
 *
 * Kept for experiments and scripting; not wired into the production executor.
 */
export class MultiMcpClient {
    private bundled: ManagedClient | null = null;
    private external: Map<string, ManagedClient> = new Map();

    /** Connect to the bundled Kletron MCP server. Throws if it fails. */
    async connectBundled(): Promise<ManagedClient> {
        if (this.bundled) return this.bundled;
        const mcpUrl = process.env.MCP_URL ?? "http://localhost:9000/sse";
        const useStdio = !mcpUrl;
        const client = buildClient();
        const transport = useStdio
            ? new StdioClientTransport({
                  command: process.execPath,
                  args: [path.resolve("apps", "mcp-server", "server.js"), "--mcp"],
                  env: { ...process.env, MCP_TRANSPORT: "stdio" } as Record<string, string>,
              })
            : (() => {
                  (globalThis as any).EventSource = EventSource as any;
                  return new SSEClientTransport(new URL(mcpUrl), bundledMcpTransportOptions());
              })();
        await client.connect(transport);
        const tools = (await client.listTools({})).tools ?? [];
        this.bundled = {
            slug: "",
            name: "kletron",
            client,
            tools,
            connectedAt: new Date(),
        };
        return this.bundled;
    }

    /**
     * Replace the set of external connections for this client instance (global map).
     * For per-workspace sync see `McpClient.syncExternalServers`.
     */
    async syncExternal(configs: ExternalMcpClientConfig[]): Promise<void> {
        const desired = new Map(configs.map((c) => [c.slug, c]));

        // Disconnect removed servers.
        for (const slug of [...this.external.keys()]) {
            if (!desired.has(slug)) {
                const managed = this.external.get(slug)!;
                try {
                    await managed.client.close();
                } catch {
                    // ignore
                }
                this.external.delete(slug);
            }
        }

        // Connect new servers.
        for (const [slug, config] of desired.entries()) {
            if (this.external.has(slug)) continue;
            try {
                const client = buildClient();
                const transport = buildTransport(config);
                const connect = client.connect(transport);
                const timeout = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error("connect timeout (10s)")), 10_000);
                });
                await Promise.race([connect, timeout]);
                const tools = (await client.listTools({})).tools ?? [];
                this.external.set(slug, {
                    slug,
                    name: config.name,
                    client,
                    tools,
                    connectedAt: new Date(),
                });
            } catch (error) {
                console.error(
                    `[MultiMcpClient] Failed to connect external MCP '${slug}':`,
                    (error as Error).message
                );
                this.external.set(slug, {
                    slug,
                    name: config.name,
                    client: buildClient(), // not connected, just a placeholder
                    tools: [],
                    connectedAt: new Date(),
                    error: (error as Error).message,
                });
            }
        }
    }

    /** Combined tool list. External tools are prefixed with `slug__`. */
    async listTools(): Promise<Array<{ name: string; description?: string; inputSchema?: unknown; serverSlug: string }>> {
        const out: Array<{ name: string; description?: string; inputSchema?: unknown; serverSlug: string }> = [];
        if (this.bundled) {
            for (const tool of this.bundled.tools) {
                out.push({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                    serverSlug: "",
                });
            }
        }
        for (const managed of this.external.values()) {
            if (managed.error) continue;
            for (const tool of managed.tools) {
                out.push({
                    name: namespacedExternalToolName(managed.slug, tool.name),
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                    serverSlug: managed.slug,
                });
            }
        }
        return out;
    }

    /**
     * Call a tool. Names containing `serverSlug__toolName` are routed to the
     * matching external server. Plain names are routed to the bundled server.
     */
    async callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
        let targetClient: Client | null = null;
        let actualName = name;
        const sepIndex = name.indexOf(MCP_TOOL_NAMESPACE_SEP);
        if (sepIndex > 0) {
            const slug = name.slice(0, sepIndex);
            const tail = name.slice(sepIndex + MCP_TOOL_NAMESPACE_SEP.length);
            const slugKey = resolveExternalServerSlugKey(this.external.keys(), slug);
            const managed = slugKey ? this.external.get(slugKey) : undefined;
            if (managed && !managed.error) {
                targetClient = managed.client;
                actualName = resolveCanonicalMcpToolName(managed.tools, tail);
            }
        }
        if (!targetClient) {
            if (!this.bundled) throw new Error("MCP client not connected");
            targetClient = this.bundled.client;
        }

        if (sepIndex <= 0 && actualName === "find_references") {
            actualName = "references";
        }

        const response = (await targetClient.callTool(
            { name: actualName, arguments: args },
            CallToolResultSchema
        )) as CallToolResult;
        const text = (response.content ?? [])
            .map((chunk) => ("text" in chunk ? chunk.text : JSON.stringify(chunk)))
            .join("\n");
        if (response.isError) {
            throw new Error(text || `Tool ${name} failed`);
        }
        return text;
    }

    /** Diagnostics. */
    status() {
        return {
            bundled: this.bundled
                ? { connectedAt: this.bundled.connectedAt, tools: this.bundled.tools.length }
                : null,
            external: Array.from(this.external.values()).map((m) => ({
                slug: m.slug,
                name: m.name,
                connectedAt: m.connectedAt,
                tools: m.tools.length,
                error: m.error,
            })),
        };
    }

    async closeAll(): Promise<void> {
        if (this.bundled) {
            try {
                await this.bundled.client.close();
            } catch {
                // ignore
            }
            this.bundled = null;
        }
        for (const managed of this.external.values()) {
            try {
                await managed.client.close();
            } catch {
                // ignore
            }
        }
        this.external.clear();
    }
}
