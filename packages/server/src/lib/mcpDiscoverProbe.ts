import { createRemoteMcpTransport } from "@kletron/mcp-client/remoteMcpTransport";
import type { McpServerProbeInput } from "@kletron/shared";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type McpProbeSuccess = {
    ok: true;
    tools: Array<{ name: string; description?: string }>;
};

export type McpProbeFailure = { ok: false; error: string };

export type McpProbeResult = McpProbeSuccess | McpProbeFailure;

const CONNECT_TIMEOUT_MS = 10_000;

/**
 * Connect to an MCP server with the given config and list tools. Does not persist anything.
 */
export async function probeMcpConnection(config: McpServerProbeInput): Promise<McpProbeResult> {
    let client: Client | null = null;
    try {
        let transport;
        if (config.transport === "stdio") {
            if (!config.command?.trim()) throw new Error("stdio transport requires command");
            const mergedEnv: Record<string, string> = {};
            for (const [k, v] of Object.entries(process.env)) {
                if (v !== undefined) mergedEnv[k] = v;
            }
            const cfgEnv = config.env ?? {};
            for (const [k, v] of Object.entries(cfgEnv)) {
                if (v !== undefined) mergedEnv[k] = String(v);
            }
            transport = new StdioClientTransport({
                command: config.command.trim(),
                args: config.args ?? [],
                env: mergedEnv,
            });
        } else {
            if (!config.url?.trim()) throw new Error("HTTP transport requires url");
            const wire = config.transport === "streamable-http" ? "streamable-http" : "sse";
            transport = createRemoteMcpTransport({
                transport: wire,
                url: config.url.trim(),
                headers: config.headers,
            });
        }

        client = new Client({ name: "kletron-mcp-probe", version: "1.0.0" }, { capabilities: {} });
        const connectPromise = client.connect(transport);
        const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("discover timeout (10s)")), CONNECT_TIMEOUT_MS);
        });
        await Promise.race([connectPromise, timeout]);

        const result = await client.listTools({});
        const tools = (result.tools ?? []).map((t) => ({
            name: t.name,
            description: t.description,
        }));
        return { ok: true, tools };
    } catch (error) {
        return { ok: false, error: (error as Error).message };
    } finally {
        if (client) {
            try {
                await client.close();
            } catch {
                // ignore
            }
        }
    }
}
