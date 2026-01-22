import path from "node:path";
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { EventSource } from "eventsource";

import { config } from "../config";

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

    const mcpUrl = process.env.MCP_URL ?? process.env.GITHUB_MCP_URL;
    const transport = mcpUrl
      ? (() => {
        // SSEClientTransport requires an EventSource implementation in Node.
        (globalThis as any).EventSource = EventSource as any;
        return new SSEClientTransport(new URL(mcpUrl));
      })()
      : (() => {
        const serverScript = path.resolve("github-mcp", "server.js");
        return new StdioClientTransport({
          command: process.execPath,
          args: [serverScript, "--mcp"],
          env: {
            ...process.env,
            MCP_DEFAULT_DIR: config.repoRoot,
            GITHUB_MCP_DEFAULT_DIR: config.repoRoot,
            MCP_TRANSPORT: "stdio",
            GITHUB_MCP_TRANSPORT: "stdio",
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

    await client.connect(transport);

    // Initialize Automated Vector Indexing
    if (!process.env.DISABLE_AUTO_INDEX) {
      try {
        const { startWatcher } = await import("../services/autoIndexer");
        const { startAutoIndexScheduler } = await import("../services/autoIndexScheduler");

        console.log("[AutoIndex] Initializing services...");
        startWatcher(config.repoRoot);
        startAutoIndexScheduler(config.repoRoot);
      } catch (error) {
        console.error("[AutoIndex] Failed to initialize:", error);
      }
    }

    McpClient.instance = new McpClient(client);
    return McpClient.instance;
  }

  async callTool(name: string, args: Record<string, unknown> = {}) {
    const response = (await this.client.callTool(
      {
        name,
        arguments: args,
      },
      CallToolResultSchema
    )) as CallToolResult;
    const contents = response.content ?? [];
    return contents
      .map((chunk) => chunk.text ?? JSON.stringify(chunk))
      .join("\n");
  }

  async listTools() {
    const result = await this.client.listTools({});
    return result.tools;
  }

  async close() {
    await this.client.close();
    McpClient.instance = null;
  }
}
