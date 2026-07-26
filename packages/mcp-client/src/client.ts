import path from "node:path";
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { EventSource } from "eventsource";

import { bundledMcpTransportOptions } from "./bundledMcpAuth";
import { getConfig } from "@kletron/server/config";
import { getWorkspaceContext } from "@kletron/server/workspace/workspaceContext";
import { createRemoteMcpTransport } from "./remoteMcpTransport";
import {
    namespacedExternalToolName,
    parseNamespacedToolName,
    resolveCanonicalMcpToolName,
    type ExternalMcpClientConfig,
} from "./multiClient";
import { resolveExternalToolRoute } from "./workspaceExternalRouting";

type ExternalToolRecord = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

type ExternalServerConn = {
  client: Client;
  tools: ExternalToolRecord[];
  error?: string;
  /** Last sync config — used to reconnect after tool-not-found or stale sessions. */
  config?: ExternalMcpClientConfig;
  /** When tools were last fetched via listTools (used to avoid listTools on every agent run). */
  lastToolsListAt?: number;
};

/** Stable fingerprint of connector settings — if this changes, we must refresh tools / reconnect. */
function externalMcpConfigFingerprint(c: ExternalMcpClientConfig): string {
  return JSON.stringify({
    t: c.transport,
    cmd: c.command,
    args: c.args,
    url: c.url,
    env: c.env,
    headers: c.headers,
  });
}

/** Min interval (ms) between tools/list refreshes for a healthy external MCP connection. Set 0 to refresh every sync. */
const EXTERNAL_MCP_TOOLS_LIST_TTL_MS = 300_000;

function externalMcpToolsListTtlMs(): number {
  return EXTERNAL_MCP_TOOLS_LIST_TTL_MS;
}

/** JSON-RPC MCP server error -32603 + common SDK phrasing for unknown tools. */
function isRecoverableExternalToolNotFound(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("-32603") || m.includes("tool not found");
}

export type McpCallToolOptions = {
  /** Required when multiple workspaces may host the same MCP slug; always set from HTTP handlers / agent runs. */
  workspaceId?: string;
};

export class McpClient {
  private static instance: McpClient | null = null;
  private readonly client: Client;
  /** External MCP connections keyed by workspace id, then server slug. */
  private externalByWorkspace = new Map<string, Map<string, ExternalServerConn>>();

  private getExternalMap(workspaceId: string): Map<string, ExternalServerConn> {
    let m = this.externalByWorkspace.get(workspaceId);
    if (!m) {
      m = new Map();
      this.externalByWorkspace.set(workspaceId, m);
    }
    return m;
  }

  private constructor(client: Client) {
    this.client = client;
  }

  static async getInstance() {
    if (McpClient.instance) {
      return McpClient.instance;
    }

    const mcpUrl = process.env.MCP_URL ?? "http://localhost:9000/sse";
    await getConfig();
    const transport = mcpUrl
      ? (() => {
        // SSEClientTransport requires an EventSource implementation in Node.
        (globalThis as any).EventSource = EventSource as any;
        return new SSEClientTransport(new URL(mcpUrl), bundledMcpTransportOptions());
      })()
      : (() => {
        const serverScript = path.resolve("apps", "mcp-server", "server.js");
        return new StdioClientTransport({
          command: process.execPath,
          args: [serverScript, "--mcp"],
          env: {
            ...process.env,
            MCP_TRANSPORT: "stdio",
          },
        });
      })();

    const client = new Client(
      { name: "kletron-mcp-client", version: "1.0.0" },
      {
        capabilities: {},
      }
    );

    try {
      await client.connect(transport);
    } catch (error: any) {
      console.error(`[McpClient] Failed to connect to MCP server (pid=${process.pid}):`, error);
      if (error.code === "EBADF") {
        console.error("Detected 'EBADF' error. This often happens on macOS when file descriptors are leaked or when spawning from a restricted context. Check system limits and open file count.");
      }
      throw error;
    }

    // Initialize Automated Vector Indexing
    const isNextWorker = process.env.NEXT_PRIVATE_WORKER ||
      process.env.IS_NEXT_WORKER ||
      process.env.NEXT_RUNTIME ||
      process.env.NODE_ENV === "test" ||
      process.argv.some(arg => arg.includes("next-dev") || arg.includes("next-server"));

    const isDisabled = process.env.DISABLE_AUTO_INDEX === "true" || !!process.env.DISABLE_AUTO_INDEX;

    console.log(`[McpClient] Initializing... pid=${process.pid} isNextWorker=${!!isNextWorker} isDisabled=${isDisabled} alreadyInit=${!!(globalThis as any).__MCP_SERVICES_INITIALIZED__}`);

    if (!isDisabled && !isNextWorker && !(globalThis as any).__MCP_SERVICES_INITIALIZED__) {
      try {
        const { startWatcher } = await import("@kletron/server/services/autoIndexer");
        const { startAutoIndexScheduler } = await import("@kletron/server/services/autoIndexScheduler");
        const { startAutomationScheduler } = await import("@kletron/server/services/automationScheduler");
        const { listAllWorkspaces, validateWorkspaceRoot } = await import("@kletron/server/services/workspaceService");

        console.log("[AutoIndex] Initializing services...");
        (globalThis as any).__MCP_SERVICES_INITIALIZED__ = true;
        const workspaces = await listAllWorkspaces();
        for (const workspace of workspaces) {
          if (!workspace._id) continue;
          const health = validateWorkspaceRoot(workspace);
          if (health.status !== "healthy") {
            console.warn(`[AutoIndex] Skipping unhealthy workspace ${workspace._id.toString()} (${health.status}): ${health.rootPath}`);
            continue;
          }
          startWatcher(workspace._id.toString(), workspace.rootPath);
          startAutoIndexScheduler(workspace._id.toString(), workspace.rootPath);
        }

        // Start the automation scheduler (global singleton, not per-workspace)
        startAutomationScheduler();
      } catch (error) {
        console.error("[AutoIndex] Failed to initialize:", error);
      }
    }

    McpClient.instance = new McpClient(client);
    return McpClient.instance;
  }

  async callTool(name: string, args: Record<string, unknown> = {}, callOpts?: McpCallToolOptions) {
    if (name === "semantic_code_search") {
      const { semanticSearch } = await import("@kletron/server/services/vectorService");
       
      const { query, ...vectorOpts } = args;
      if (typeof query !== "string") {
        throw new Error("Missing query parameter for semantic_code_search");
      }
      const results = await semanticSearch(query, vectorOpts);
      return JSON.stringify(results, null, 2);
    }

    if (name === "sentry_api") {
      const { runSentryApiTool } = await import("@kletron/server/services/sentryApiTool");
      const ctx = getWorkspaceContext();
      return await runSentryApiTool(ctx?.workspaceId, args);
    }

    // External MCP server tools are namespaced as `<slug>__<toolName>`.
    let targetClient: Client = this.client;
    const { serverSlug, toolName: parsedTool } = parseNamespacedToolName(name);
    // Legacy id: LangChain no longer exposes find_references; bundled server maps it too.
    let actualName = !serverSlug && name === "find_references" ? "references" : name;
    let slugKeyForReconnect: string | null = null;
    let workspaceIdForReconnect: string | null = null;
    if (serverSlug) {
      const route = resolveExternalToolRoute(this.externalByWorkspace, serverSlug, callOpts?.workspaceId);
      if (route) {
        const ext = this.externalByWorkspace.get(route.workspaceId)?.get(route.slugKey);
        if (!ext || ext.error) {
          throw new Error(`Cannot route external tool '${name}': connector '${route.slugKey}' unavailable.`);
        }
        targetClient = ext.client;
        actualName = resolveCanonicalMcpToolName(ext.tools, parsedTool);
        slugKeyForReconnect = route.slugKey;
        workspaceIdForReconnect = route.workspaceId;
      } else {
        const hint =
          callOpts?.workspaceId?.trim() ?
            `Workspace '${callOpts.workspaceId.trim()}' has no active connection for MCP server '${serverSlug}'. Run agent sync or reconnect the connector.`
            : `No active MCP connection for server '${serverSlug}' (pass workspaceId if multiple workspaces use the same slug).`;
        throw new Error(`Cannot route external tool '${name}': ${hint}`);
      }
    }

    const runExternalCall = async (): Promise<string> => {
      const response = (await targetClient.callTool(
        {
          name: actualName,
          arguments: args,
        },
        CallToolResultSchema
      )) as CallToolResult;

      const contents = response.content ?? [];
      const text = contents
        .map((chunk) => ("text" in chunk ? chunk.text : JSON.stringify(chunk)))
        .join("\n");

      if (response.isError) {
        throw new Error(text || `Tool ${name} failed without error message`);
      }

      return text;
    };

    try {
      return await runExternalCall();
    } catch (firstErr) {
      const msg = (firstErr as Error)?.message ?? String(firstErr);
      if (
        slugKeyForReconnect &&
        workspaceIdForReconnect &&
        isRecoverableExternalToolNotFound(msg) &&
        (await this.reconnectExternalServer(workspaceIdForReconnect, slugKeyForReconnect))
      ) {
        const map = this.externalByWorkspace.get(workspaceIdForReconnect)!;
        const ext = map.get(slugKeyForReconnect)!;
        targetClient = ext.client;
        actualName = resolveCanonicalMcpToolName(ext.tools, parsedTool);
        return await runExternalCall();
      }
      throw firstErr;
    }
  }


  async listTools() {
    const result = await this.client.listTools({});
    type ListedTool = NonNullable<(typeof result)["tools"]>[number];
    const merged: ListedTool[] = [...(result.tools ?? [])];
    for (const [, map] of this.externalByWorkspace) {
      for (const [slug, ext] of map) {
        if (ext.error) continue;
        for (const tool of ext.tools) {
          merged.push({
            ...tool,
            name: namespacedExternalToolName(slug, tool.name),
          } as ListedTool);
        }
      }
    }
    return merged;
  }

  /**
   * Sync the set of external MCP servers connected to this client. Servers
   * present in `configs` that aren't connected get connected; servers
   * connected but missing from `configs` get disconnected.
   *
   * Healthy connections are kept open. **`tools/list` is refreshed** when the
   * connector config changes, on reconnect, or when `EXTERNAL_MCP_TOOLS_LIST_TTL_MS`
   * expires so agent runs are not blocked on every send. If `listTools` fails, the client reconnects once from stored config.
   */
  async syncExternalServers(workspaceId: string, configs: ExternalMcpClientConfig[]) {
    const ws = workspaceId.trim();
    if (!ws) {
      console.warn("[McpClient] syncExternalServers: empty workspaceId — skipping");
      return;
    }
    const external = this.getExternalMap(ws);
    const desired = new Map(configs.map((c) => [c.slug, c]));
    for (const slug of [...external.keys()]) {
      if (!desired.has(slug)) {
        try {
          await external.get(slug)!.client.close();
        } catch {
          // ignore
        }
        external.delete(slug);
      }
    }
    const toolsListTtl = externalMcpToolsListTtlMs();
    for (const [slug, config] of desired.entries()) {
      const existing = external.get(slug);
      if (existing && !existing.error) {
        const now = Date.now();
        const configSame =
          existing.config !== undefined &&
          externalMcpConfigFingerprint(existing.config) === externalMcpConfigFingerprint(config);
        const cacheFresh =
          toolsListTtl > 0 &&
          configSame &&
          existing.tools.length > 0 &&
          typeof existing.lastToolsListAt === "number" &&
          now - existing.lastToolsListAt < toolsListTtl;
        if (cacheFresh) {
          external.set(slug, { ...existing, config });
          continue;
        }
        try {
          const tools = ((await existing.client.listTools({})).tools ?? []) as ExternalToolRecord[];
          external.set(slug, {
            client: existing.client,
            tools,
            config,
            lastToolsListAt: Date.now(),
          });
          continue;
        } catch (err) {
          console.warn(
            `[McpClient] tools/list failed for external '${slug}' (workspace ${ws}), reconnecting:`,
            (err as Error).message
          );
          try {
            await existing.client.close();
          } catch {
            // ignore
          }
          external.delete(slug);
        }
      }
      if (existing?.error) {
        try {
          await existing.client.close();
        } catch {
          // ignore
        }
        external.delete(slug);
      }
      await this.connectExternalServer(ws, slug, config);
    }
    if (external.size === 0) {
      this.externalByWorkspace.delete(ws);
    }
  }

  private async connectExternalServer(
    workspaceId: string,
    slug: string,
    config: ExternalMcpClientConfig
  ): Promise<void> {
    const disconnected = new Client(
      { name: "kletron-mcp-client", version: "1.0.0" },
      { capabilities: {} }
    );
    try {
      const client = new Client(
        { name: "kletron-mcp-client", version: "1.0.0" },
        { capabilities: {} }
      );
      let transport;
      if (config.transport === "stdio") {
        if (!config.command) throw new Error(`stdio MCP '${slug}' missing command`);
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
          env: { ...process.env, ...(config.env ?? {}) } as Record<string, string>,
        });
      } else {
        if (!config.url) throw new Error(`MCP '${slug}' missing url`);
        const wire = config.transport === "streamable-http" ? "streamable-http" : "sse";
        transport = createRemoteMcpTransport({
          transport: wire,
          url: config.url,
          headers: config.headers,
        });
      }
      await Promise.race([
        client.connect(transport),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("connect timeout (10s)")), 10_000)
        ),
      ]);
      const tools = ((await client.listTools({})).tools ?? []) as ExternalToolRecord[];
      const external = this.getExternalMap(workspaceId);
      external.set(slug, { client, tools, config, lastToolsListAt: Date.now() });
    } catch (error) {
      console.error(
        `[McpClient] Failed to connect external MCP '${slug}' (workspace ${workspaceId}):`,
        (error as Error).message
      );
      const external = this.getExternalMap(workspaceId);
      external.set(slug, {
        client: disconnected,
        tools: [],
        error: (error as Error).message,
        config,
      });
    }
  }

  /** Drop and reconnect one external server using the last successful sync config. */
  private async reconnectExternalServer(workspaceId: string, slugKey: string): Promise<boolean> {
    const map = this.externalByWorkspace.get(workspaceId);
    if (!map) return false;
    const ext = map.get(slugKey);
    const config = ext?.config;
    if (!config) {
      console.warn(
        `[McpClient] Cannot reconnect external MCP '${slugKey}' (workspace ${workspaceId}): no stored config`
      );
      return false;
    }
    try {
      await ext.client.close();
    } catch {
      // ignore
    }
    map.delete(slugKey);
    await this.connectExternalServer(workspaceId, slugKey, config);
    return !map.get(slugKey)?.error;
  }

  /** Diagnostic summary of all connected servers. */
  externalStatus() {
    const rows: Array<{ workspaceId: string; slug: string; tools: number; error?: string }> = [];
    for (const [workspaceId, map] of this.externalByWorkspace) {
      for (const [slug, ext] of map) {
        rows.push({
          workspaceId,
          slug,
          tools: ext.tools.length,
          error: ext.error,
        });
      }
    }
    return rows;
  }

  /**
   * Snapshot of external tools for one workspace (namespaced `slug__toolName`).
   */
  listExternalTools(workspaceId: string): Array<{
    serverSlug: string;
    name: string;
    description?: string;
    inputSchema?: unknown;
  }> {
    const ws = workspaceId.trim();
    const out: Array<{
      serverSlug: string;
      name: string;
      description?: string;
      inputSchema?: unknown;
    }> = [];
    if (!ws) return out;
    const map = this.externalByWorkspace.get(ws);
    if (!map) return out;
    for (const [slug, ext] of map) {
      if (ext.error) continue;
      for (const tool of ext.tools) {
        out.push({
          serverSlug: slug,
          name: namespacedExternalToolName(slug, tool.name),
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
    }
    return out;
  }

  async close() {
    for (const map of this.externalByWorkspace.values()) {
      for (const ext of map.values()) {
        try {
          await ext.client.close();
        } catch {
          // ignore
        }
      }
    }
    this.externalByWorkspace.clear();
    await this.client.close();
    McpClient.instance = null;
  }

  static async reloadInstance() {
    console.log("[McpClient] Reloading instance due to configuration change...");

    // 1. Stop background services if they were initialized in this process
    if ((globalThis as any).__MCP_SERVICES_INITIALIZED__) {
      try {
        const { stopWatcher } = await import("@kletron/server/services/autoIndexer");
        const { stopAutoIndexScheduler } = await import("@kletron/server/services/autoIndexScheduler");
        stopWatcher();
        stopAutoIndexScheduler();
        (globalThis as any).__MCP_SERVICES_INITIALIZED__ = false;
        console.log("[McpClient] Background services stopped.");
      } catch (e) {
        console.error("[McpClient] Error stopping background services:", e);
      }
    }

    // 2. Close and nullify the current client instance
    if (McpClient.instance) {
      try {
        await McpClient.instance.close();
        console.log("[McpClient] Client connection closed.");
      } catch (e) {
        console.error("[McpClient] Error closing client:", e);
        McpClient.instance = null;
      }
    }

    // 3. Re-initialize by calling getInstance() which will fetch fresh config
    return await McpClient.getInstance();
  }
}
