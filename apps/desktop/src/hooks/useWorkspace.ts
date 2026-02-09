import { useEffect, useState } from "react";
import type { WorkspaceInfo, WorkspaceSummary } from "../types";
import { WORKSPACE_STORAGE_KEY, deriveWorkspaceName } from "../utils";

export function useWorkspace(
  backendUrlTrimmed: string,
  getAccessToken: () => Promise<string | null>
) {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(() => {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceInfo) : null;
  });
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

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
      if (summary?.rootPath && (!workspace || workspace.path !== summary.rootPath)) {
        setWorkspace({
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
  };
}
