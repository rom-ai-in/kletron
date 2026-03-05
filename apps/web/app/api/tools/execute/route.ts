import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { McpClient } from "@numezis/mcp-client/client";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@numezis/server/services/workspaceService";

export async function POST(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await req.json();
        const { toolName, args } = body;

        if (!toolName) {
            return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
        }

        const workspace = await resolveWorkspaceFromRequestStrict(req, auth.userId, body as any);
        if (!workspace || !workspace._id) {
            return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
        }

        const repoRoot = path.resolve(workspace.rootPath);
        const resolvedArgs: Record<string, unknown> = { ...(args || {}) };
        const resolvePathArg = (key: string, defaultToRoot = false) => {
            const val = resolvedArgs[key];
            if (typeof val === "string") {
                const absolute = path.isAbsolute(val) ? path.resolve(val) : path.resolve(repoRoot, val);
                if (!absolute.startsWith(repoRoot)) {
                    throw new Error(`Path outside workspace root for ${key}`);
                }
                resolvedArgs[key] = absolute;
            } else if ((val === undefined || val === null) && defaultToRoot) {
                resolvedArgs[key] = repoRoot;
            }
        };

        resolvePathArg("path", true);
        resolvePathArg("filePath", false);
        resolvePathArg("repoPath", true);

        const client = await McpClient.getInstance();
        const result = await client.callTool(toolName, resolvedArgs);

        return NextResponse.json({ result });
    } catch (error: any) {
        const workspaceError = workspaceErrorToHttp(error);
        if (workspaceError) {
            return NextResponse.json(workspaceError.body, { status: workspaceError.status });
        }
        console.error("Tool execution failed:", error);
        return NextResponse.json(
            { error: error.message || "Tool execution failed" },
            { status: 500 }
        );
    }
}
