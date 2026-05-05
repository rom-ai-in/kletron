import type { GetRequestHeaders } from "@kletron/shared";
import type {
  WorkspaceIntegrationSummary,
  WorkspaceMcpServerSummary,
} from "@kletron/shared/connectors/types";

/** How long connector lists are reused across hook instances / remounts (streaming re-renders). */
export const WORKSPACE_CONNECTORS_CACHE_TTL_MS = 60_000;

export type WorkspaceConnectorsSnapshot = {
  integrations: WorkspaceIntegrationSummary[];
  mcpServers: WorkspaceMcpServerSummary[];
};

const cache = new Map<string, { data: WorkspaceConnectorsSnapshot; ts: number }>();
const inflight = new Map<string, Promise<WorkspaceConnectorsSnapshot>>();

export function workspaceConnectorsCacheKey(apiOrigin: string, workspaceId: string): string {
  return `${apiOrigin.replace(/\/$/, "")}\u0000${workspaceId}`;
}

export function invalidateWorkspaceConnectorsCache(apiOrigin: string, workspaceId: string): void {
  cache.delete(workspaceConnectorsCacheKey(apiOrigin, workspaceId));
}

export function peekWorkspaceConnectorsCache(
  apiOrigin: string,
  workspaceId: string,
  maxAgeMs: number = WORKSPACE_CONNECTORS_CACHE_TTL_MS
): WorkspaceConnectorsSnapshot | null {
  const ent = cache.get(workspaceConnectorsCacheKey(apiOrigin, workspaceId));
  if (!ent) return null;
  if (Date.now() - ent.ts > maxAgeMs) return null;
  return ent.data;
}

/**
 * Single-flight fetch + in-memory cache. Concurrent callers for the same workspace share one network pair.
 */
export async function fetchWorkspaceConnectorsSnapshot(args: {
  apiOrigin: string;
  workspaceId: string;
  getRequestHeaders: GetRequestHeaders;
}): Promise<WorkspaceConnectorsSnapshot> {
  const { apiOrigin, workspaceId, getRequestHeaders } = args;
  const key = workspaceConnectorsCacheKey(apiOrigin, workspaceId);

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async (): Promise<WorkspaceConnectorsSnapshot> => {
    const base = apiOrigin.replace(/\/$/, "");
    const headers = await getRequestHeaders();
    const h: Record<string, string> = { ...headers };
    if (workspaceId && !h["x-workspace-id"]) h["x-workspace-id"] = workspaceId;

    const [intRes, mcpRes] = await Promise.all([
      fetch(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/connectors/integrations`, {
        headers: h,
        cache: "no-store",
      }),
      fetch(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/connectors/mcp-servers`, {
        headers: h,
        cache: "no-store",
      }),
    ]);

    if (!intRes.ok) throw new Error(`integrations: ${intRes.status}`);
    if (!mcpRes.ok) throw new Error(`mcp-servers: ${mcpRes.status}`);

    const intJson = (await intRes.json()) as { integrations?: WorkspaceIntegrationSummary[] };
    const mcpJson = (await mcpRes.json()) as { servers?: WorkspaceMcpServerSummary[] };

    const data: WorkspaceConnectorsSnapshot = {
      integrations: intJson.integrations ?? [],
      mcpServers: mcpJson.servers ?? [],
    };
    cache.set(key, { data, ts: Date.now() });
    return data;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, p);
  return p;
}
