export const dynamic = "force-dynamic";

import { codexExecutionService } from "@kletron/server/services/codexExecutionService";
import { requireCodexAuth, sanitizeCodexPayload } from "../_shared";

export async function GET(request: Request) {
  const authResult = await requireCodexAuth(request);
  if (!authResult.ok) return authResult.response;

  try {
    const limits = await codexExecutionService.readRateLimits(authResult.auth.userId);
    return new Response(JSON.stringify(sanitizeCodexPayload(limits)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error)?.message ?? "Failed to read Codex rate limits" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
