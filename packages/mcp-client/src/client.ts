import path from "node:path";
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { EventSource } from "eventsource";

import { config, getConfig } from "@numezis/server/config";

type ToolResultContent = {
  text?: string;
  type?: string;
};

export class McpClient {
  private static instance: McpClient | null = null;
  private readonly client: Client;

  private constructor(client: Client) {
    this.client = client;
  }

  static async getInstance() {
    if (McpClient.instance) {
      return McpClient.instance;
    }

    const mcpUrl = process.env.MCP_URL ?? "http://localhost:9000/sse";
    const cfg = await getConfig();
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
            MCP_DEFAULT_DIR: cfg.workingFolder,
            MCP_TRANSPORT: "stdio",
          },
        });
      })();

    const client = new Client(
      { name: "numezis-mcp-client", version: "1.0.0" },
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
        const { startWatcher } = await import("@numezis/server/services/autoIndexer");
        const { startAutoIndexScheduler } = await import("@numezis/server/services/autoIndexScheduler");
        const { listAllWorkspaces } = await import("@numezis/server/services/workspaceService");

        console.log("[AutoIndex] Initializing services...");
        (globalThis as any).__MCP_SERVICES_INITIALIZED__ = true;
        const workspaces = await listAllWorkspaces();
        for (const workspace of workspaces) {
          if (!workspace._id) continue;
          startWatcher(workspace._id.toString(), workspace.rootPath);
          startAutoIndexScheduler(workspace._id.toString(), workspace.rootPath);
        }
      } catch (error) {
        console.error("[AutoIndex] Failed to initialize:", error);
      }
    }

    McpClient.instance = new McpClient(client);
    return McpClient.instance;
  }

  async callTool(name: string, args: Record<string, unknown> = {}) {
    if (name === "semantic_code_search") {
      const { semanticSearch } = await import("@numezis/server/services/vectorService");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { query, ...options } = args;
      if (typeof query !== "string") {
        throw new Error("Missing query parameter for semantic_code_search");
      }
      const results = await semanticSearch(query, options);
      return JSON.stringify(results, null, 2);
    }

    const response = (await this.client.callTool(
      {
        name,
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
  }


  async listTools() {
    const result = await this.client.listTools({});
    return result.tools;
  }

  async close() {
    await this.client.close();
    McpClient.instance = null;
  }

  static async reloadInstance() {
    console.log("[McpClient] Reloading instance due to configuration change...");

    // 1. Stop background services if they were initialized in this process
    if ((globalThis as any).__MCP_SERVICES_INITIALIZED__) {
      try {
        const { stopWatcher } = await import("@numezis/server/services/autoIndexer");
        const { stopAutoIndexScheduler } = await import("@numezis/server/services/autoIndexScheduler");
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
