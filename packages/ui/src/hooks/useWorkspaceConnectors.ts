import { useCallback, useEffect, useState } from "react";
import type { WorkspaceIntegrationSummary } from "@kletron/shared/connectors/types";
import type { GetRequestHeaders } from "@kletron/shared";

export function useWorkspaceConnectors(options: {
  apiOrigin: string;
  workspaceId: string | null;
  getRequestHeaders: GetRequestHeaders;
  enabled?: boolean;
}) {
  const { apiOrigin, workspaceId, getRequestHeaders, enabled = true } = options;
  const [integrations, setIntegrations] = useState<WorkspaceIntegrationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId || !enabled) {
      setIntegrations([]);
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
      const res = await fetch(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/connectors/integrations`, {
        headers: h,
      });
      if (!res.ok) throw new Error(`integrations: ${res.status}`);
      const intJson = (await res.json()) as { integrations?: WorkspaceIntegrationSummary[] };
      setIntegrations(intJson.integrations ?? []);
    } catch (e) {
      setError((e as Error).message);
      setIntegrations([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiOrigin, workspaceId, getRequestHeaders, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { integrations, isLoading, error, refresh };
}
