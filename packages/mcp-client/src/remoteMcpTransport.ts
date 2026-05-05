import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { EventSource } from "eventsource";

/** Wire modes that speak HTTP + optional SSE (not stdio). */
export type RemoteMcpWireTransport = "sse" | "streamable-http";

function compactHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
    if (!headers) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        if (v !== undefined && String(v).trim() !== "") out[k] = String(v);
    }
    return Object.keys(out).length ? out : undefined;
}

/**
 * Node's global EventSource is required by MCP SDK transports that open SSE streams.
 */
export function installMcpNodeEventSource(): void {
    if (!(globalThis as unknown as { EventSource?: unknown }).EventSource) {
        (globalThis as unknown as { EventSource: typeof EventSource }).EventSource = EventSource;
    }
}

/**
 * Build the MCP client transport for a remote server (SSE or Streamable HTTP).
 * Applies optional HTTP headers on both the SSE leg and POSTs (SDK merges `requestInit`).
 */
export function createRemoteMcpTransport(opts: {
    transport: RemoteMcpWireTransport;
    url: string;
    headers?: Record<string, string>;
}): SSEClientTransport | StreamableHTTPClientTransport {
    const url = new URL(opts.url);
    const headers = compactHeaders(opts.headers);
    const transportOpts = headers ? { requestInit: { headers } as RequestInit } : undefined;

    if (opts.transport === "streamable-http") {
        return new StreamableHTTPClientTransport(url, transportOpts);
    }

    installMcpNodeEventSource();
    return new SSEClientTransport(url, transportOpts);
}
