import { useCallback } from "react";
import { useAutomations as useAutomationsCore } from "@kletron/ui/hooks/useAutomations";

/** Desktop wrapper: Bearer + `x-workspace-id` via shared `useAutomations` hook. */
export function useAutomations(
  backendUrlTrimmed: string,
  backendReady: boolean,
  getAccessToken: () => Promise<string | null>,
  activeWorkspaceId: string | null
) {
  const getRequestHeaders = useCallback(async () => {
    const token = await getAccessToken();
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    if (activeWorkspaceId) h["x-workspace-id"] = activeWorkspaceId;
    return h;
  }, [getAccessToken, activeWorkspaceId]);

  return useAutomationsCore({
    apiOrigin: backendUrlTrimmed,
    backendReady,
    workspaceId: activeWorkspaceId,
    getRequestHeaders,
  });
}
