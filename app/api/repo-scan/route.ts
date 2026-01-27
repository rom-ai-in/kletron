
import { NextRequest, NextResponse } from "next/server";
import { runRepoAnalysis } from "@/src/agents/repoScannerAgent";
import { getLlmConfig } from "@/src/services/llmConfigService";
import { getConfig, ConfigNotSetError } from "@/src/config";

// Ensure dynamic route
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                // 1. Check if repository path is configured
                let config;
                try {
                    config = await getConfig();
                } catch (e) {
                    if (e instanceof ConfigNotSetError) {
                        sendEvent({
                            type: "error",
                            message: "Repository path not configured. Please configure it in Configuration > Repository Settings first.",
                        });
                        controller.close();
                        return;
                    }
                    throw e;
                }

                // 2. Validation - Ensure LLM is configured
                const llm = await getLlmConfig();
                const provider = llm.provider || llm.defaultProvider;
                const hasKey = provider === "azure" ? !!llm.azure?.apiKey : true;

                if (!hasKey) {
                    sendEvent({ type: "error", message: "LLM not configured. Please configure in /config/llm" });
                    controller.close();
                    return;
                }

                // 3. Use the configured workspace
                const workspaceRoot = config.mcpDefaultDir;
                sendEvent({ type: "log", message: `Target Workspace: ${workspaceRoot}` });

                // 4. Run Analysis on the configured target repository
                const result = await runRepoAnalysis(workspaceRoot, (msg) => {
                    sendEvent({ type: "log", message: msg });
                });

                // 5. Send Result
                sendEvent({ type: "result", payload: result });

                // 6. Cleanup
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
