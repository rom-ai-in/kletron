import { useCallback, useRef } from "react";
import type { GetRequestHeaders } from "@kletron/shared";

/**
 * Stable `GetRequestHeaders` for the Electron shell (Bearer + `x-workspace-id`).
 *
 * Aligns with the web agent pattern (`webAgentConnectorHeaders` in
 * `apps/web/components/agent/WorkspaceConnectorsHint.tsx`): the function
 * reference stays constant while token/workspace are read from refs so hooks
 * like `useWorkspaceConnectors` never enter dependency-driven fetch loops.
 */
export function useStableAgentRequestHeaders(
  getAccessToken: () => Promise<string | null | undefined>,
  activeWorkspaceId: string | null
): GetRequestHeaders {
  const tokenGetterRef = useRef(getAccessToken);
  tokenGetterRef.current = getAccessToken;
  const workspaceIdRef = useRef(activeWorkspaceId);
  workspaceIdRef.current = activeWorkspaceId;

  return useCallback(async () => {
    const token = await tokenGetterRef.current();
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    const ws = workspaceIdRef.current;
    if (ws) h["x-workspace-id"] = ws;
    return h;
  }, []);
}
