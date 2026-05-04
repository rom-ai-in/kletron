
import { NextRequest, NextResponse } from "next/server";
import { runRepoAnalysis } from "@kletron/agent-core/agents/repoScannerAgent";
import { getLlmConfig } from "@kletron/server/services/llmConfigService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";
import { contextGraphStore, ContextGraphStore } from "@kletron/server/context/graph/ContextGraphStore";
import { contextScanner, ContextScanner } from "@kletron/server/context/graph/ContextScanner";

// Ensure dynamic route
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const auth = await requireAppRouteAuth(req);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
                if (!workspace || !workspace._id) {
                    sendEvent({
                        type: "error",
                        message: "Workspace not configured. Please configure it in Configuration > Workspace Settings first.",
                    });
                    controller.close();
                    return;
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
                const workspaceRoot = workspace.rootPath;
                sendEvent({ type: "log", message: `Target Workspace: ${workspaceRoot}` });

                // 4. Run Analysis on the configured target repository
                const result = await runRepoAnalysis(workspaceRoot, (msg) => {
                    sendEvent({ type: "log", message: msg });
                });

                // 4b. Persist/update the server-side context graph
                try {
                    sendEvent({ type: "log", message: "Updating context graph..." });
                    const store = contextGraphStore;
                    await store.load();
                    await contextScanner.scanWorkspace(workspaceRoot);
                    sendEvent({ type: "log", message: `Context graph updated (${store.getAllNodes().length} nodes).` });
                } catch (err: any) {
                    sendEvent({ type: "log", message: `Context graph update failed: ${err?.message || "unknown error"}` });
                }

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
