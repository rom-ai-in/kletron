export const dynamic = "force-dynamic";

import { codexExecutionService } from "@kletron/server/services/codexExecutionService";
import { requireCodexAuth, sanitizeCodexPayload } from "../../_shared";

type LoginType = "chatgpt" | "chatgptDeviceCode" | "apiKey";

function parseLoginType(input: unknown): LoginType {
  if (input === "chatgpt") return "chatgpt";
  if (input === "apiKey") return "apiKey";
  return "chatgptDeviceCode";
}

export async function POST(request: Request) {
  const authResult = await requireCodexAuth(request);
  if (!authResult.ok) return authResult.response;

  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const type = parseLoginType(payload.type);
  const apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : undefined;

  try {
    const login = await codexExecutionService.login(authResult.auth.userId, type, apiKey);
    return new Response(JSON.stringify(sanitizeCodexPayload(login)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error)?.message ?? "Failed to start Codex login" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
