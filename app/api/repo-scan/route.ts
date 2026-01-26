
import { NextRequest, NextResponse } from "next/server";
import { runRepoAnalysis } from "@/src/agents/repoScannerAgent"; // Adjust path if needed
import { getLlmConfig } from "@/src/services/llmConfigService";
import path from "path";
import * as fs from "fs/promises";

// Ensure dynamic route
export const dynamic = "force-dynamic";

// Helper to reliably locate the workspace root.
// In this app, we assume `process.cwd()` or a configured workspace.
// For now, let's look for a configured workspace in existing config if possible, 
// or default to process.cwd() for the MCP server context if running locally.
async function getWorkspaceRoot(): Promise<string> {
    // 1. Try to read from config.json (centralized config)
    // Note: detailed config reading might be complex, so we'll try a simpler approach or default
    try {
        // Minimal config read - reusing existing pattern if available
        // Or check environment variable
        if (process.env.MCP_WORKSPACE_ROOT) {
            return process.env.MCP_WORKSPACE_ROOT;
        }
    } catch (e) { }

    // Fallback: Current working directory of the server
    return process.cwd();
}


export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                // 1. Validation
                // Ensure LLM is configured
                // We'll let the agent handle specific config errors, or check basic validity here
                const llm = await getLlmConfig();
                const provider = llm.provider || llm.defaultProvider;
                const hasKey = provider === "azure" ? !!llm.azure?.apiKey : true; // LM Studio might not need key

                if (!hasKey) {
                    sendEvent({ type: "error", message: "LLM not configured. Please configure in /config/llm" });
                    controller.close();
                    return;
                }

                const workspaceRoot = await getWorkspaceRoot();
                sendEvent({ type: "log", message: `Target Workspace: ${workspaceRoot}` });

                // 2. Run Analysis
                const result = await runRepoAnalysis(workspaceRoot, (msg) => {
                    sendEvent({ type: "log", message: msg });
                });

                // 3. Send Result
                sendEvent({ type: "result", payload: result });

                // 4. Cleanup
                controller.close();

            } catch (error: any) {
                console.error("Repo Scan Error:", error);
                sendEvent({ type: "error", message: error.message || "Unknown error during scan" });
                controller.close();
            }
        },
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
