import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { ZodTypeAny } from "zod";
import { z } from "zod";

import { verifyLocalMcpToken } from "@kletron/server/lib/codexLocalMcpAuth";
import { getWorkspaceById, isMongoObjectIdParam } from "@kletron/server/services/workspaceService";
import { buildGoogleWorkspaceTools } from "@kletron/server/services/googleWorkspaceTools";
import { runWithWorkspaceContext } from "@kletron/server/workspace/workspaceContext";

export const runtime = "nodejs";

/** Avoid rebuilding LangChain tool graphs on every Streamable-HTTP POST (initialize / tools/list / tools/call). */
const googleWorkspaceToolsCache = new Map<string, ReturnType<typeof buildGoogleWorkspaceTools>>();
const GOOGLE_WS_TOOLS_CACHE_MAX = 64;

function getCachedGoogleWorkspaceTools(workspaceId: string): ReturnType<typeof buildGoogleWorkspaceTools> {
    let tools = googleWorkspaceToolsCache.get(workspaceId);
    if (!tools) {
        tools = buildGoogleWorkspaceTools(workspaceId);
        googleWorkspaceToolsCache.set(workspaceId, tools);
        while (googleWorkspaceToolsCache.size > GOOGLE_WS_TOOLS_CACHE_MAX) {
            const oldest = googleWorkspaceToolsCache.keys().next().value;
            if (oldest === undefined) break;
            googleWorkspaceToolsCache.delete(oldest);
        }
    }
    return tools;
}

function jsonError(status: number, error: string): Response {
    return new Response(JSON.stringify({ error }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

async function handleMcpRequest(req: Request, workspaceIdFromPath: string): Promise<Response> {
    try {
        const wid = workspaceIdFromPath.trim();
        if (!isMongoObjectIdParam(wid)) {
            return jsonError(400, "Invalid workspace id");
        }

        const payload = verifyLocalMcpToken(req.headers.get("authorization"));
        if (!payload) {
            return jsonError(401, "Unauthorized");
        }

        if (payload.workspaceId !== wid) {
            return jsonError(403, "Workspace mismatch");
        }

        const workspace = await getWorkspaceById(wid, payload.userId);
        if (!workspace) {
            return jsonError(404, "Workspace not found");
        }

        return await runWithWorkspaceContext(workspace, async () => {
            const mcpServer = new McpServer({ name: "kletron-workspace", version: "1.0.0" });
            const tools = getCachedGoogleWorkspaceTools(wid);

            for (const lcTool of tools) {
                const name = lcTool.name as string;
                const description = typeof lcTool.description === "string" ? lcTool.description : "";
                const inputSchema = (lcTool as { schema?: ZodTypeAny }).schema ?? z.object({});

                mcpServer.registerTool(
                    name,
                    {
                        description,
                        inputSchema,
                    },
                    async (args: Record<string, unknown>) => {
                        try {
                            const out = await lcTool.invoke(args);
                            const text = typeof out === "string" ? out : JSON.stringify(out);
                            return { content: [{ type: "text" as const, text }] };
                        } catch (error) {
                            const msg = error instanceof Error ? error.message : String(error);
                            return { isError: true as const, content: [{ type: "text" as const, text: msg }] };
                        }
                    },
                );
            }

            const transport = new WebStandardStreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
                enableJsonResponse: true,
            });

            await mcpServer.connect(transport);
            try {
                return await transport.handleRequest(req);
            } finally {
                await mcpServer.close().catch(() => undefined);
                await transport.close().catch(() => undefined);
            }
        }, { userId: payload.userId });
    } catch (error) {
        console.error("[api/mcp/workspace] handler error:", (error as Error)?.message ?? error);
        return jsonError(500, "Internal Server Error");
    }
}

export async function GET(req: Request, ctx: { params: Promise<{ workspaceId: string }> }) {
    const { workspaceId } = await ctx.params;
    return handleMcpRequest(req, workspaceId);
}

export async function POST(req: Request, ctx: { params: Promise<{ workspaceId: string }> }) {
    const { workspaceId } = await ctx.params;
    return handleMcpRequest(req, workspaceId);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ workspaceId: string }> }) {
    const { workspaceId } = await ctx.params;
    return handleMcpRequest(req, workspaceId);
}
