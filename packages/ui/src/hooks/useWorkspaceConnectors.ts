import { useCallback, useEffect, useState } from "react";
import type {
  WorkspaceIntegrationSummary,
  WorkspaceMcpServerSummary,
} from "@kletron/shared/connectors/types";
import type { GetRequestHeaders } from "@kletron/shared";

const defaultHeaders: GetRequestHeaders = async () => ({});

export function useWorkspaceConnectors(options: {
  apiOrigin: string;
  workspaceId: string | null;
  getRequestHeaders?: GetRequestHeaders;
  enabled?: boolean;
}) {
  const {
    apiOrigin,
    workspaceId,
    getRequestHeaders = defaultHeaders,
    enabled = true,
  } = options;
  const [integrations, setIntegrations] = useState<WorkspaceIntegrationSummary[]>([]);
  const [mcpServers, setMcpServers] = useState<WorkspaceMcpServerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId || !enabled) {
      setIntegrations([]);
      setMcpServers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const base = apiOrigin.replace(/\/$/, "");
      const headers = await getRequestHeaders();
      const h: Record<string, string> = { ...headers };
      if (workspaceId && !h["x-workspace-id"]) h["x-workspace-id"] = workspaceId;
      const [intRes, mcpRes] = await Promise.all([
        fetch(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/connectors/integrations`, {
          headers: h,
        }),
        fetch(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/connectors/mcp-servers`, {
          headers: h,
        }),
      ]);
      if (!intRes.ok) throw new Error(`integrations: ${intRes.status}`);
      if (!mcpRes.ok) throw new Error(`mcp-servers: ${mcpRes.status}`);
      const intJson = (await intRes.json()) as { integrations?: WorkspaceIntegrationSummary[] };
      const mcpJson = (await mcpRes.json()) as { servers?: WorkspaceMcpServerSummary[] };
      setIntegrations(intJson.integrations ?? []);
      setMcpServers(mcpJson.servers ?? []);
    } catch (e) {
      setError((e as Error).message);
      setIntegrations([]);
      setMcpServers([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiOrigin, workspaceId, getRequestHeaders, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { integrations, mcpServers, isLoading, error, refresh };
}
