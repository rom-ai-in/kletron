import { useEffect, useRef, useState } from "react";
import type { WorkspaceInfo, WorkspaceSummary } from "../types";
import { WORKSPACE_STORAGE_KEY, deriveWorkspaceName, pathsEqual } from "../utils";

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
    window.numezis.setWorkspace(workspace.path).catch(() => undefined);
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

  async function selectWorkspace() {
    const result = await window.numezis.selectWorkspace();
    if (result) {
      setWorkspace(result);
    }
  }

  return {
    workspace,
    setWorkspace,
    workspaceSummary,
    workspaceLoading,
    loadWorkspaceSummary,
    selectWorkspace,
    allowBackendSync,
  };
}
