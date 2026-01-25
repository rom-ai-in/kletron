import { NextRequest, NextResponse } from "next/server";
import { McpClient } from "@/src/mcp/client";

export async function POST(req: NextRequest) {
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
