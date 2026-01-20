import { config } from "../config.js";

function parseAllowlistFromEnv() {
  const raw = process.env.GITHUB_MCP_FETCH_ALLOWLIST || process.env.MCP_FETCH_ALLOWLIST || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowedHost(hostname, allowlist) {
  if (!allowlist || allowlist.length === 0) return false;
  const host = hostname.toLowerCase();

  for (const entry of allowlist) {
    const rule = entry.toLowerCase();
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(1); // keep ".example.com"
      if (host.endsWith(suffix)) return true;
    } else if (host === rule) {
      return true;
    }
  }

  return false;
}

export const fetchUrl = {
  description:
    "Fetch a URL (HTTPS only) with a strict domain allowlist to prevent SSRF.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string" },
      timeoutMs: { type: "number" },
      maxBytes: { type: "number" },
      allowlist: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional allowlist override (domains or *.wildcards). If omitted, uses MCP_FETCH_ALLOWLIST/GITHUB_MCP_FETCH_ALLOWLIST.",
      },
    },
    required: ["url"],
  },
  async run({ url, timeoutMs = 10_000, maxBytes, allowlist } = {}) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Invalid URL.");
    }

    if (parsed.protocol !== "https:") {
      throw new Error("Only https:// URLs are allowed.");
    }

    const effectiveAllowlist =
      allowlist && allowlist.length ? allowlist : parseAllowlistFromEnv().length ? parseAllowlistFromEnv() : config.fetchAllowlist;

    if (!isAllowedHost(parsed.hostname, effectiveAllowlist)) {
      throw new Error(
        `Host not allowed by allowlist. Set MCP_FETCH_ALLOWLIST/GITHUB_MCP_FETCH_ALLOWLIST to include '${parsed.hostname}'.`
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const limit = Number.isFinite(maxBytes) ? Math.trunc(maxBytes) : config.fetchMaxBytes;

    try {
      const res = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          "user-agent": "github-mcp/1.0",
          accept: "text/html,text/plain,application/json,*/*",
        },
      });

      const contentType = res.headers.get("content-type");
      const buffer = Buffer.from(await res.arrayBuffer());
      const truncated = buffer.length > limit;
      const sliced = truncated ? buffer.subarray(0, limit) : buffer;
      const text = sliced.toString("utf-8");

      return {
        url: parsed.toString(),
        status: res.status,
        ok: res.ok,
        contentType,
        truncated,
        bytes: sliced.length,
        text,
      };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Fetch timed out.");
      }
      throw new Error(error?.message ? String(error.message) : "Fetch failed.");
    } finally {
      clearTimeout(timeout);
    }
  },
};
