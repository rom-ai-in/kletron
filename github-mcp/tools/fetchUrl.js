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
    "Fetch a URL (HTTPS only) with a strict domain allowlist to prevent SSRF. Use checkOnly=true to test if a domain is allowed before fetching.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string" },
      timeoutMs: { type: "number" },
      maxBytes: { type: "number" },
      checkOnly: {
        type: "boolean",
        description:
          "If true, only check if the domain is allowed without fetching. Returns a suggestion if blocked.",
      },
      allowlist: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional allowlist override (domains or *.wildcards). If omitted, uses MCP_FETCH_ALLOWLIST/GITHUB_MCP_FETCH_ALLOWLIST.",
      },
    },
    required: ["url"],
  },
  async run({ url, timeoutMs = 10_000, maxBytes, checkOnly = false, allowlist } = {}) {
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

    const hostname = parsed.hostname;
    const isAllowed = isAllowedHost(hostname, effectiveAllowlist);

    // Domain discovery mode: return structured response instead of throwing
    if (!isAllowed) {
      if (checkOnly) {
        return {
          blocked: true,
          url: parsed.toString(),
          hostname,
          suggested_domain: hostname,
          current_allowlist: effectiveAllowlist,
          reason: `Domain '${hostname}' is not in the allowlist. Add it to GITHUB_MCP_FETCH_ALLOWLIST or MCP_FETCH_ALLOWLIST to enable fetching.`,
          hint: `Set env: GITHUB_MCP_FETCH_ALLOWLIST="${[...effectiveAllowlist, hostname].join(",")}"`,
        };
      }
      throw new Error(
        `Host not allowed by allowlist. Set MCP_FETCH_ALLOWLIST/GITHUB_MCP_FETCH_ALLOWLIST to include '${hostname}'.`
      );
    }

    // If only checking, return success without fetching
    if (checkOnly) {
      return {
        blocked: false,
        url: parsed.toString(),
        hostname,
        allowed: true,
        message: `Domain '${hostname}' is allowed. You can proceed with fetching.`,
      };
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
