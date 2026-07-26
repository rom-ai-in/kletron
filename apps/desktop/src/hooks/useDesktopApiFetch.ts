import { useCallback } from "react";

/**
 * Backend-aware fetch for Electron: absolute URL + Bearer + workspace header.
 *
 * `onUnauthorized` is the desktop counterpart of the web's `AUTH_SESSION_INVALID_EVENT`:
 * a 401 gets one refresh attempt, and a refused refresh locks the shell.
 */
export function useDesktopApiFetch(
  backendUrlTrimmed: string,
  getAccessToken: () => Promise<string | null>,
  activeWorkspaceId: string | null,
  onUnauthorized?: () => void
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
      const res = await fetch(url, { ...init, headers });
      if (res.status === 401 && token) onUnauthorized?.();
      return res;
    },
    [backendUrlTrimmed, getAccessToken, activeWorkspaceId, onUnauthorized]
  );
}
