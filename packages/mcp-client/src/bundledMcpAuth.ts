/**
 * Credentials for the bundled Kletron MCP server's HTTP/SSE transport.
 *
 * The bundled server authenticates /sse and /message with a shared secret
 * (see apps/mcp-server/lib/httpAuth.js). The same token the web app already
 * uses for internal MCP -> web calls is reused here, so a deployment only ever
 * configures one value.
 *
 * The MCP SDK merges `requestInit.headers` into both the SSE GET leg and the
 * message POSTs, so a single `requestInit` covers the whole transport.
 */

const TOKEN_ENV_VARS = [
    "MCP_SERVER_TOKEN",
    "MCP_INTERNAL_TOKEN",
    "KLETRON_INTERNAL_TOKEN",
] as const;

export function resolveBundledMcpToken(env: NodeJS.ProcessEnv = process.env): string | null {
    for (const name of TOKEN_ENV_VARS) {
        const value = env[name];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

/** Transport options carrying the bearer credential, or undefined when unset (loopback dev). */
export function bundledMcpTransportOptions(
    env: NodeJS.ProcessEnv = process.env
): { requestInit: RequestInit } | undefined {
    const token = resolveBundledMcpToken(env);
    if (!token) return undefined;
    return { requestInit: { headers: { Authorization: `Bearer ${token}` } } };
}
