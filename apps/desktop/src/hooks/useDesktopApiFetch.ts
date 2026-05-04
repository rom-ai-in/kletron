import { useCallback } from "react";

/**
 * Backend-aware fetch for Electron: absolute URL + Bearer + workspace header.
 */
export function useDesktopApiFetch(
  backendUrlTrimmed: string,
  getAccessToken: () => Promise<string | null>,
  activeWorkspaceId: string | null
) {
  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const base = backendUrlTrimmed.replace(/\/$/, "");
      const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
      const token = await getAccessToken();
      const headers = new Headers(init?.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (activeWorkspaceId) headers.set("x-workspace-id", activeWorkspaceId);
      return fetch(url, { ...init, headers });
    },
    [backendUrlTrimmed, getAccessToken, activeWorkspaceId]
  );
}
