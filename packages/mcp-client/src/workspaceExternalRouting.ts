import { resolveExternalServerSlugKey } from "./multiClient";

/**
 * Minimal shape needed to route `slug__toolName` calls. Keeps routing logic
 * free of MCP `Client` handles so it can be regression-tested in isolation.
 */
export type ExternalConnectionRoutingView = {
    tools: Array<{ name: string }>;
    error?: string;
};

/**
 * Resolve which workspace + connector slug key should handle a namespaced MCP tool.
 *
 * Rules:
 * - If `explicitWorkspaceId` is set, only that workspace's connectors are considered.
 * - If omitted, routing succeeds only when **exactly one** workspace has a healthy
 *   connector matching `serverSlug` (case-insensitive slug match). Multiple matches
 *   return null so callers must pass `workspaceId` (agent + HTTP handlers should
 *   always pass it).
 */
export function resolveExternalToolRoute(
    externalByWorkspace: ReadonlyMap<string, ReadonlyMap<string, ExternalConnectionRoutingView>>,
    serverSlug: string,
    explicitWorkspaceId?: string
): { workspaceId: string; slugKey: string } | null {
    const trimmedWs = explicitWorkspaceId?.trim() ?? "";
    if (trimmedWs) {
        const map = externalByWorkspace.get(trimmedWs);
        if (!map) return null;
        const slugKey = resolveExternalServerSlugKey(map.keys(), serverSlug);
        if (!slugKey) return null;
        const conn = map.get(slugKey);
        if (!conn || conn.error) return null;
        return { workspaceId: trimmedWs, slugKey };
    }
    let found: { workspaceId: string; slugKey: string } | null = null;
    for (const [wsId, map] of externalByWorkspace) {
        const slugKey = resolveExternalServerSlugKey(map.keys(), serverSlug);
        if (!slugKey) continue;
        const conn = map.get(slugKey);
        if (!conn || conn.error) continue;
        if (found !== null && found.workspaceId !== wsId) {
            return null;
        }
        found = { workspaceId: wsId, slugKey };
    }
    return found;
}
