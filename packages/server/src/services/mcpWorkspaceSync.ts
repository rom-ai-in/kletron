import { McpClient } from "@kletron/mcp-client/client";
import type { ExternalMcpClientConfig } from "@kletron/mcp-client/multiClient";

import { getExternalMcpRuntimeConfig } from "./connectorsService";

/** Connect / refresh external MCP servers for one workspace (isolated from other workspaces). */
export async function syncWorkspaceExternalMcpServers(workspaceId: string): Promise<void> {
    const ws = workspaceId.trim();
    if (!ws) return;
    const configs = await getExternalMcpRuntimeConfig(ws);
    const mapped: ExternalMcpClientConfig[] = configs.map((s) => ({
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
    const client = await McpClient.getInstance();
    await client.syncExternalServers(ws, mapped);
}
