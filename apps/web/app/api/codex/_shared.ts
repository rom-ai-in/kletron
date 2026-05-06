import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

const SENSITIVE_KEY_PATTERNS = [
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /id[_-]?token/i,
  /^authorization$/i,
  /^cookie$/i,
  /api[_-]?key/i,
  /secret/i,
  /session[_-]?token/i,
];

function shouldRedactKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function sanitizeCodexPayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[REDACTED_DEPTH]";
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(/(access_token|refresh_token|id_token|authorization|cookie|api_key)\s*[:=]\s*([^\s"']+)/gi, "$1=[REDACTED]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => sanitizeCodexPayload(entry, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = shouldRedactKey(key) ? "[REDACTED]" : sanitizeCodexPayload(raw, depth + 1);
  }
  return out;
}

export async function requireCodexAuth(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return {
      ok: false as const,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  return {
    ok: true as const,
    auth,
  };
}
