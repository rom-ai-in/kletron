import { useEffect, useRef, useState, useCallback } from "react";
import type { WorkspaceInfo, WorkspaceSummary } from "../types";
import { WORKSPACE_STORAGE_KEY, deriveWorkspaceName, pathsEqual } from "../utils";

export type BackendWorkspace = {
  id: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  provider?: string;
  defaultBranch?: string;
  status?: string;
  health?: "healthy" | "missing" | "inaccessible";
  healthMessage?: string | null;
  selectable?: boolean;
};

export function useWorkspace(
  backendUrlTrimmed: string,
  getAccessToken: () => Promise<string | null>
) {
  const [workspace, setWorkspaceRaw] = useState<WorkspaceInfo | null>(() => {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceInfo) : null;
  });
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  /** True while a workspace switch (switchWorkspaceById) is in progress */
  const [switching, setSwitching] = useState(false);
  const [allWorkspaces, setAllWorkspaces] = useState<BackendWorkspace[]>([]);

  // Track whether the workspace was explicitly set by the user/app (thread select,
  // add project, etc.).  When true, `loadWorkspaceSummary` will not override it.
  // Starts as `false` so the first `loadWorkspaceSummary` call (app boot) can
  // seed the workspace from the backend.  Once the user or app explicitly sets
  // a workspace, it flips to `true` and stays there for the session.
  const explicitSwitchRef = useRef(false);

  /** Public setter — marks the switch as explicit so backend summary won't override it. */
  function setWorkspace(info: WorkspaceInfo) {
    explicitSwitchRef.current = true;
    setWorkspaceRaw(info);
  }

  /** Allow a one-time backend sync (e.g., on reconnect).
   *  Call this only if you intentionally want `loadWorkspaceSummary` to be able
   *  to set the workspace again. */
  function allowBackendSync() {
    explicitSwitchRef.current = false;
  }

  useEffect(() => {
    if (!workspace) return;
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace]);

  useEffect(() => {
    if (!workspace?.path) return;
    window.kletron.setWorkspace(workspace.path).catch(() => undefined);
  }, [workspace?.path]);

  async function loadWorkspaceSummary() {
    const token = await getAccessToken();
    if (!token) return;
    setWorkspaceLoading(true);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/workspaces/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load workspace (${res.status})`);
      }
      const data = await res.json();
      const summary = data?.workspace ?? null;
      setWorkspaceSummary(summary);

      // Only auto-set the workspace from backend if the user hasn't explicitly switched
      if (
        summary?.rootPath &&
        !explicitSwitchRef.current &&
        (!workspace || !pathsEqual(workspace.path, summary.rootPath))
      ) {
        setWorkspaceRaw({
          path: summary.rootPath,
          name: deriveWorkspaceName(summary.rootPath, summary.name),
        });
      }
    } catch {
      // ignore for now
    } finally {
      setWorkspaceLoading(false);
    }
  }

  const refreshAllWorkspaces = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/workspaces?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: BackendWorkspace[] = Array.isArray(data.workspaces) ? data.workspaces : [];
      setAllWorkspaces(list);
    } catch {
      // ignore
    }
  }, [backendUrlTrimmed, getAccessToken]);

  // Load full workspace list on mount and periodically
  useEffect(() => {
    void refreshAllWorkspaces();
    const interval = setInterval(() => void refreshAllWorkspaces(), 60_000);
    return () => clearInterval(interval);
  }, [refreshAllWorkspaces]);

  /** Switch the active workspace on the backend by ID, then refresh local state */
  async function switchWorkspaceById(id: string) {
    const token = await getAccessToken();
    if (!token) return;
    setSwitching(true);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/workspaces/${id}/select`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      // Find the workspace in allWorkspaces to set local state
      const ws = allWorkspaces.find((w) => w.id === id);
      if (ws) {
        setWorkspace({ path: ws.rootPath, name: ws.name });
      }
      // Refresh the summary and full list
      await loadWorkspaceSummary();
      await refreshAllWorkspaces();
    } catch {
      // ignore
    } finally {
      setSwitching(false);
    }
  }

  async function selectWorkspace() {
    const result = await window.kletron.selectWorkspace();
    if (result) {
      setWorkspace(result);
    }
  }

  return {
    workspace,
    setWorkspace,
    workspaceSummary,
    workspaceLoading,
    switching,
    loadWorkspaceSummary,
    selectWorkspace,
    allowBackendSync,
    allWorkspaces,
    refreshAllWorkspaces,
    switchWorkspaceById,
  };
}
