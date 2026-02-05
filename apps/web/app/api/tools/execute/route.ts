import { NextRequest, NextResponse } from "next/server";
import { McpClient } from "@numezis/mcp-client/client";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

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

        const client = await McpClient.getInstance();
        const result = await client.callTool(toolName, args || {});

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error("Tool execution failed:", error);
        return NextResponse.json(
            { error: error.message || "Tool execution failed" },
            { status: 500 }
        );
    }
}
