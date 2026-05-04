// Connect to a configured external MCP server and refresh its tool list.
// Persists the discovered tools so the UI can show them without reconnecting.

import { NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EventSource } from "eventsource";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    getExternalMcpRuntimeConfig,
    listMcpServers,
    recordMcpServerStatus,
} from "@kletron/server/services/connectorsService";
import {
    getWorkspaceById,
    getWorkspaceByIdUnsafe,
} from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";

async function loadWorkspace(workspaceId: string, auth: { userId: string; authType: string }) {
    if (auth.authType === "internal") return getWorkspaceByIdUnsafe(workspaceId);
    return getWorkspaceById(workspaceId, auth.userId);
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { workspaceId, id } = await params;
    const workspace = await loadWorkspace(workspaceId, auth);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const all = await getExternalMcpRuntimeConfig(workspaceId);
    const target = all.find((s) => s.id === id);
    if (!target) {
        // Fall back to listing without enabled-filter so we can also discover for disabled servers.
        const allServers = await listMcpServers(workspaceId);
        const disabled = allServers.find((s) => s.id === id);
        if (!disabled) {
            return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
        }
    }

    const config = target ?? (await listMcpServers(workspaceId)).find((s) => s.id === id);
    if (!config) return NextResponse.json({ error: "MCP server not found" }, { status: 404 });

    let client: Client | null = null;
    try {
        let transport;
        if (config.transport === "stdio") {
            if (!config.command) throw new Error("stdio transport requires command");
            const mergedEnv: Record<string, string> = {};
            for (const [k, v] of Object.entries(process.env)) {
                if (v !== undefined) mergedEnv[k] = v;
            }
            const cfgEnv = "env" in config && config.env ? config.env : {};
            for (const [k, v] of Object.entries(cfgEnv)) {
                if (v !== undefined) mergedEnv[k] = String(v);
            }
            transport = new StdioClientTransport({
                command: config.command,
                args: config.args ?? [],
                env: mergedEnv,
            });
        } else {
            if (!config.url) throw new Error("HTTP transport requires url");
            (globalThis as any).EventSource = EventSource as any;
            transport = new SSEClientTransport(new URL(config.url));
        }

        client = new Client(
            { name: "kletron-mcp-discoverer", version: "1.0.0" },
            { capabilities: { tools: {} } }
        );
        // Prevent hanging on broken endpoints.
        const connectPromise = client.connect(transport);
        const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("discover timeout (10s)")), 10_000);
        });
        await Promise.race([connectPromise, timeout]);

        const result = await client.listTools({});
        const tools = (result.tools ?? []).map((t) => ({
            name: t.name,
            description: t.description,
        }));
        await recordMcpServerStatus(workspaceId, id, {
            status: "connected",
            statusMessage: `${tools.length} tools`,
            discoveredTools: tools,
        });
        return NextResponse.json({ ok: true, tools });
    } catch (error) {
        const message = (error as Error).message;
        await recordMcpServerStatus(workspaceId, id, {
            status: "error",
            statusMessage: message,
        });
        return NextResponse.json({ ok: false, error: message }, { status: 502 });
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
