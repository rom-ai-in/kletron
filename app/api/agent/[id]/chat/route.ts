import { ReActEngine } from "@/src/services/agent/ReActEngine";
import { AgentEvent } from "@/src/types";
import { resolveLlmSelection } from "@/src/llm";

export const dynamic = "force-dynamic";

const textEncoder = new TextEncoder();

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const payload = await request.json().catch(() => ({} as any));
    const message = payload.message || "";
    const conversationId = params.id;
    const provider = typeof payload?.llmProvider === "string" ? payload.llmProvider.trim() : undefined;

    if (!conversationId) {
        return new Response("Missing conversation ID", { status: 400 });
    }

    // Resolve LLM selection from request (ActiveSession passes 'llmProvider')
    const llmSelection = provider ? resolveLlmSelection({ provider }) : undefined;

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (event: any) => {
                controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            };

            try {
                const engine = ReActEngine.getInstance();

                await engine.chat(conversationId, message, (event: AgentEvent) => {
                    sendEvent(event);
                }, llmSelection);

                controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
            } catch (error: any) {
                console.error("Agent chat error:", error);
                const errorEvent: AgentEvent = {
                    id: `err-${Date.now()}`,
                    phaseId: "chat",
                    kind: "assistant",
                    role: "assistant",
                    content: `Error: ${error.message}`,
                    timestamp: new Date().toISOString()
                };
                sendEvent(errorEvent);
                controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
