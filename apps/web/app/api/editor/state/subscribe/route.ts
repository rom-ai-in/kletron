import { editorStore, subscribers } from "../../store";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: "SYNC", payload: editorStore });

      const sendUpdate = (state: any) => {
        send({ type: "SYNC", payload: state });
      };

      subscribers.add(sendUpdate);

      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15000);

      const cleanup = () => {
        clearInterval(interval);
        subscribers.delete(sendUpdate);
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
