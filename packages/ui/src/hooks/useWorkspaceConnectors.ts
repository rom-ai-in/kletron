import { useCallback, useEffect, useRef, useState } from "react";
import type {
  WorkspaceIntegrationSummary,
  WorkspaceMcpServerSummary,
} from "@kletron/shared/connectors/types";
import type { GetRequestHeaders } from "@kletron/shared";
import {
  fetchWorkspaceConnectorsSnapshot,
  invalidateWorkspaceConnectorsCache,
  peekWorkspaceConnectorsCache,
} from "./workspaceConnectorsShared";

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

  /** Inline `getRequestHeaders` from parents must not invalidate effects every render. */
  const getRequestHeadersRef = useRef(getRequestHeaders);
  getRequestHeadersRef.current = getRequestHeaders;

  const skipPeekOnceRef = useRef(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (!workspaceId || !enabled) {
      setIntegrations([]);
      setMcpServers([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const origin = apiOrigin;
    const ws = workspaceId;

    const apply = (snap: { integrations: WorkspaceIntegrationSummary[]; mcpServers: WorkspaceMcpServerSummary[] }) => {
      if (cancelled) return;
      setIntegrations(snap.integrations);
      setMcpServers(snap.mcpServers);
      setError(null);
      setIsLoading(false);
    };

    const skipPeek = skipPeekOnceRef.current;
    skipPeekOnceRef.current = false;

    if (!skipPeek) {
      const cached = peekWorkspaceConnectorsCache(origin, ws);
      if (cached) {
        apply(cached);
        return () => {
          cancelled = true;
        };
      }
    }

    setIsLoading(true);
    setError(null);

    void fetchWorkspaceConnectorsSnapshot({
      apiOrigin: origin,
      workspaceId: ws,
      getRequestHeaders: () => getRequestHeadersRef.current(),
    })
      .then((snap) => apply(snap))
      .catch((e) => {
        if (cancelled) return;
        setError((e as Error).message);
        setIntegrations([]);
        setMcpServers([]);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiOrigin, workspaceId, enabled, refreshNonce]);

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!workspaceId || !enabled) {
        setIntegrations([]);
        setMcpServers([]);
        setIsLoading(false);
        setError(null);
        return;
      }
      if (opts?.force) {
        invalidateWorkspaceConnectorsCache(apiOrigin, workspaceId);
      }
      skipPeekOnceRef.current = true;
      setRefreshNonce((n) => n + 1);
    },
    [apiOrigin, workspaceId, enabled]
  );

  return { integrations, mcpServers, isLoading, error, refresh };
}
