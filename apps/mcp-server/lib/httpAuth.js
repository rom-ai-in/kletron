// Authentication + bind-host policy for the MCP server's HTTP/SSE transport.
//
// The SSE transport exposes `execute_bash` (and every other tool) over plain
// HTTP. Before this module existed the handler had no auth at all and bound
// 0.0.0.0, which on a public deployment is an unauthenticated remote shell.
//
// Policy:
//   * A shared bearer token is REQUIRED for every /sse and /message request.
//   * The listener binds loopback unless MCP_BIND_HOST says otherwise.
//   * Binding a non-loopback interface without a token is a startup error —
//     we fail closed rather than silently exposing the tool surface.

import { createHash, timingSafeEqual } from "node:crypto";

/** Token env vars, in precedence order. MCP_INTERNAL_TOKEN is the one the web app already shares with us. */
const TOKEN_ENV_VARS = [
  "MCP_SERVER_TOKEN",
  "MCP_INTERNAL_TOKEN",
  "KLETRON_INTERNAL_TOKEN",
];

const MIN_TOKEN_LENGTH = 32;

/**
 * Placeholder values shipped in example configs. Accepting one of these would
 * be equivalent to no auth at all, so they are rejected as if unset.
 */
const REJECTED_TOKEN_VALUES = new Set([
  "change-me",
  "change-me-long-random-token",
  "changeme",
  "secret",
  "token",
  "development-only-change-me-32chars-min",
]);

export class McpAuthConfigError extends Error {}

/**
 * Resolve the shared secret guarding the HTTP transport.
 * Returns null when no usable token is configured.
 *
 * An unusable value (placeholder, too short) resolves to null rather than
 * throwing: on a loopback bind it is simply not needed, and on an exposed bind
 * {@link assertTransportSecurity} turns the same null into a refused startup.
 * That keeps a stale `.env` from breaking local development while still
 * failing closed wherever the token is what protects the tool surface.
 */
export function resolveMcpAuthToken(env = process.env) {
  for (const name of TOKEN_ENV_VARS) {
    const raw = env[name];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;

    if (REJECTED_TOKEN_VALUES.has(value.toLowerCase())) {
      console.error(
        `[mcp] ${name} is a well-known placeholder and is being ignored. ` +
          `Generate a real secret with \`openssl rand -hex 32\`.`
      );
      return null;
    }
    if (value.length < MIN_TOKEN_LENGTH) {
      console.error(
        `[mcp] ${name} is shorter than ${MIN_TOKEN_LENGTH} characters and is being ignored.`
      );
      return null;
    }
    return value;
  }
  return null;
}

export function isLoopbackHost(host) {
  const h = String(host ?? "").trim().toLowerCase();
  return h === "127.0.0.1" || h === "localhost" || h === "::1" || h.startsWith("127.");
}

/**
 * Bind address for the HTTP listener. Defaults to loopback: a bundled MCP
 * server is normally reached by the co-located web app, not from the network.
 */
export function resolveBindHost(env = process.env) {
  const raw = (env.MCP_BIND_HOST || env.MCP_HOST || "").trim();
  return raw || "127.0.0.1";
}

/**
 * Fail closed: refuse to expose the tool surface on a non-loopback interface
 * without a shared secret.
 */
export function assertTransportSecurity({ host, token }) {
  if (!isLoopbackHost(host) && !token) {
    throw new McpAuthConfigError(
      `Refusing to start: MCP_BIND_HOST=${host} exposes execute_bash beyond loopback ` +
        `but no shared secret is configured. Set MCP_SERVER_TOKEN (or MCP_INTERNAL_TOKEN) ` +
        `to a value of at least ${MIN_TOKEN_LENGTH} characters, or bind 127.0.0.1.`
    );
  }
}

/** Length-independent constant-time comparison (compares SHA-256 digests). */
function secureEquals(a, b) {
  const da = createHash("sha256").update(String(a)).digest();
  const db = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(da, db);
}

/**
 * Extract the presented credential from either an `Authorization: Bearer`
 * header or the internal-token header the web app already sends.
 */
export function extractPresentedToken(req) {
  const auth = req.headers?.authorization;
  if (typeof auth === "string") {
    const [scheme, ...rest] = auth.trim().split(/\s+/);
    const value = rest.join(" ").trim();
    if (scheme?.toLowerCase() === "bearer" && value) return value;
  }
  for (const name of ["x-mcp-internal-token", "x-internal-token"]) {
    const v = req.headers?.[name];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v[0]?.trim()) return v[0].trim();
  }
  return null;
}

/**
 * True when the request carries the shared secret.
 * When no token is configured the server is loopback-only (enforced at
 * startup by {@link assertTransportSecurity}), so local callers are allowed.
 */
export function isAuthorizedRequest(req, token) {
  if (!token) return true;
  const presented = extractPresentedToken(req);
  if (!presented) return false;
  return secureEquals(presented, token);
}

/** Write a 401 with the standard challenge. */
export function rejectUnauthorized(res) {
  res.writeHead(401, {
    "Content-Type": "application/json",
    "WWW-Authenticate": 'Bearer realm="kletron-mcp"',
  });
  res.end(JSON.stringify({ error: "Unauthorized" }));
}
