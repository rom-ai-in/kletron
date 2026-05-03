import path from "node:path";
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { EventSource } from "eventsource";

import { getConfig } from "@kletron/server/config";
import {
    namespacedExternalToolName,
    parseNamespacedToolName,
    resolveCanonicalMcpToolName,
    resolveExternalServerSlugKey,
    type ExternalMcpClientConfig,
} from "./multiClient";

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
};

/** JSON-RPC MCP server error -32603 + common SDK phrasing for unknown tools. */
function isRecoverableExternalToolNotFound(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("-32603") || m.includes("tool not found");
}

export class McpClient {
  private static instance: McpClient | null = null;
  private readonly client: Client;
  /** Lazy-initialized multi-server client for external MCP servers. */
  private external = new Map<string, ExternalServerConn>();

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
        return new SSEClientTransport(new URL(mcpUrl));
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
        capabilities: {
          tools: {},
        },
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

  async callTool(name: string, args: Record<string, unknown> = {}) {
    if (name === "semantic_code_search") {
      const { semanticSearch } = await import("@kletron/server/services/vectorService");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { query, ...options } = args;
      if (typeof query !== "string") {
        throw new Error("Missing query parameter for semantic_code_search");
      }
      const results = await semanticSearch(query, options);
      return JSON.stringify(results, null, 2);
    }

    // External MCP server tools are namespaced as `<slug>__<toolName>`.
    let targetClient: Client = this.client;
    const { serverSlug, toolName: parsedTool } = parseNamespacedToolName(name);
    let actualName = name;
    let slugKeyForReconnect: string | null = null;
    if (serverSlug) {
      const slugKey = resolveExternalServerSlugKey(this.external.keys(), serverSlug);
      const ext = slugKey ? this.external.get(slugKey) : undefined;
      if (ext && !ext.error) {
        targetClient = ext.client;
        actualName = resolveCanonicalMcpToolName(ext.tools, parsedTool);
        slugKeyForReconnect = slugKey;
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
        .map((chunk) => chunk.text ?? JSON.stringify(chunk))
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
        isRecoverableExternalToolNotFound(msg) &&
        (await this.reconnectExternalServer(slugKeyForReconnect))
      ) {
        const ext = this.external.get(slugKeyForReconnect)!;
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
    for (const [slug, ext] of this.external.entries()) {
      if (ext.error) continue;
      for (const tool of ext.tools) {
        merged.push({
          ...tool,
          name: namespacedExternalToolName(slug, tool.name),
        } as ListedTool);
      }
    }
    return merged;
  }

  /**
   * Sync the set of external MCP servers connected to this client. Servers
   * present in `configs` that aren't connected get connected; servers
   * connected but missing from `configs` get disconnected.
   *
   * Healthy connections are kept open but **`tools/list` is refreshed every
   * sync** so renamed tools on the MCP server are picked up without a process
   * restart. If `listTools` fails, the client reconnects once from stored config.
   */
  async syncExternalServers(configs: ExternalMcpClientConfig[]) {
    const desired = new Map(configs.map((c) => [c.slug, c]));
    for (const slug of [...this.external.keys()]) {
      if (!desired.has(slug)) {
        try {
          await this.external.get(slug)!.client.close();
        } catch {
          // ignore
        }
        this.external.delete(slug);
      }
    }
    for (const [slug, config] of desired.entries()) {
      const existing = this.external.get(slug);
      if (existing && !existing.error) {
        try {
          const tools = ((await existing.client.listTools({})).tools ?? []) as ExternalToolRecord[];
          this.external.set(slug, { client: existing.client, tools, config });
          continue;
        } catch (err) {
          console.warn(
            `[McpClient] tools/list failed for external '${slug}', reconnecting:`,
            (err as Error).message
          );
          try {
            await existing.client.close();
          } catch {
            // ignore
          }
          this.external.delete(slug);
        }
      }
      if (existing?.error) {
        try {
          await existing.client.close();
        } catch {
          // ignore
        }
        this.external.delete(slug);
      }
      await this.connectExternalServer(slug, config);
    }
  }

  private async connectExternalServer(slug: string, config: ExternalMcpClientConfig): Promise<void> {
    const disconnected = new Client(
      { name: "kletron-mcp-client", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    try {
      const client = new Client(
        { name: "kletron-mcp-client", version: "1.0.0" },
        { capabilities: { tools: {} } }
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
        (globalThis as any).EventSource = EventSource as any;
        transport = new SSEClientTransport(new URL(config.url));
      }
      await Promise.race([
        client.connect(transport),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("connect timeout (10s)")), 10_000)
        ),
      ]);
      const tools = ((await client.listTools({})).tools ?? []) as ExternalToolRecord[];
      this.external.set(slug, { client, tools, config });
    } catch (error) {
      console.error(`[McpClient] Failed to connect external MCP '${slug}':`, (error as Error).message);
      this.external.set(slug, {
        client: disconnected,
        tools: [],
        error: (error as Error).message,
        config,
      });
    }
  }

  /** Drop and reconnect one external server using the last successful sync config. */
  private async reconnectExternalServer(slug: string): Promise<boolean> {
    const ext = this.external.get(slug);
    const config = ext?.config;
    if (!config) {
      console.warn(`[McpClient] Cannot reconnect external MCP '${slug}': no stored config`);
      return false;
    }
    try {
      await ext!.client.close();
    } catch {
      // ignore
    }
    this.external.delete(slug);
    await this.connectExternalServer(slug, config);
    return !this.external.get(slug)?.error;
  }

  /** Diagnostic summary of all connected servers. */
  externalStatus() {
    return Array.from(this.external.entries()).map(([slug, ext]) => ({
      slug,
      tools: ext.tools.length,
      error: ext.error,
    }));
  }

  /**
   * Snapshot of every tool exposed by currently-connected external servers.
   * Names are returned namespaced as `slug__toolName` so callers can hand
   * them straight to the agent runtime and route via `callTool`.
   */
  listExternalTools(): Array<{
    serverSlug: string;
    name: string;
    description?: string;
    inputSchema?: unknown;
  }> {
    const out: Array<{
      serverSlug: string;
      name: string;
      description?: string;
      inputSchema?: unknown;
    }> = [];
    for (const [slug, ext] of this.external.entries()) {
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
    for (const ext of this.external.values()) {
      try {
        await ext.client.close();
      } catch {
        // ignore
      }
    }
    this.external.clear();
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
