export const dynamic = "force-dynamic";

import { codexExecutionService } from "@kletron/server/services/codexExecutionService";
import { requireCodexAuth, sanitizeCodexPayload } from "../_shared";

export async function GET(request: Request) {
  const authResult = await requireCodexAuth(request);
  if (!authResult.ok) return authResult.response;

  const refreshTokenParam = new URL(request.url).searchParams.get("refreshToken");
  const refreshToken = refreshTokenParam == null ? true : refreshTokenParam === "true";

  try {
    const account = await codexExecutionService.readAccount(authResult.auth.userId, refreshToken);
    return new Response(JSON.stringify(sanitizeCodexPayload(account)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error)?.message ?? "Failed to read Codex account" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
