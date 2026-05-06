import React, { useMemo, useCallback } from "react";
import {
  WorkspaceContextBridge,
  type WorkspaceContextValue,
  type WorkspaceSummary,
} from "@kletron/ui/context/WorkspaceContext";
import { useWorkspace } from "../hooks/useWorkspace";

type DesktopWorkspace = ReturnType<typeof useWorkspace>;

export function DesktopWorkspaceProvider({
  children,
  backendUrlTrimmed,
  getAccessToken,
  workspace,
}: {
  children: React.ReactNode;
  backendUrlTrimmed: string;
  getAccessToken: () => Promise<string | null>;
  workspace: DesktopWorkspace;
}) {
  const {
    allWorkspaces,
    workspaceSummary,
    workspaceLoading,
    switching,
    refreshAllWorkspaces,
    switchWorkspaceById,
  } = workspace;

  const workspaces: WorkspaceSummary[] = useMemo(
    () =>
      allWorkspaces.map((w) => ({
        id: w.id,
        name: w.name,
        rootPath: w.rootPath,
        repoUrl: w.repoUrl,
        provider: w.provider,
        defaultBranch: w.defaultBranch,
        status: w.status,
        health: w.health,
        healthMessage: w.healthMessage,
        selectable: w.selectable,
      })),
    [allWorkspaces]
  );

  const activeWorkspace: WorkspaceSummary | null = useMemo(() => {
    if (!workspaceSummary?.id) return null;
    return {
      id: workspaceSummary.id,
      name: workspaceSummary.name,
      rootPath: workspaceSummary.rootPath,
      repoUrl: workspaceSummary.repoUrl,
      provider: workspaceSummary.provider,
      defaultBranch: workspaceSummary.defaultBranch,
      status: workspaceSummary.status,
    };
  }, [workspaceSummary]);

  const hasWorkspaceHealthIssues = useMemo(
    () => workspaces.some((w) => (w.health ?? "healthy") !== "healthy"),
    [workspaces]
  );

  const switchWorkspace = useCallback(
    async (id: string) => {
      await switchWorkspaceById(id);
    },
    [switchWorkspaceById]
  );

  const refreshWorkspaces = useCallback(async (_opts?: { silent?: boolean }) => {
    await refreshAllWorkspaces();
  }, [refreshAllWorkspaces]);

  const createWorkspace = useCallback(
    async (input: { rootPath: string; name?: string; repoUrl?: string }): Promise<WorkspaceSummary | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      try {
        const res = await fetch(`${backendUrlTrimmed}/api/workspaces`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        });
        if (!res.ok) return null;
        const data = await res.json();
        await refreshAllWorkspaces();
        const ws = data?.workspace;
        if (!ws?.id) return null;
        return {
          id: String(ws.id),
          name: ws.name,
          rootPath: ws.rootPath,
          repoUrl: ws.repoUrl,
          provider: ws.provider,
          defaultBranch: ws.defaultBranch,
          status: ws.status,
        };
      } catch {
        return null;
      }
    },
    [backendUrlTrimmed, getAccessToken, refreshAllWorkspaces]
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const res = await fetch(`${backendUrlTrimmed}/api/workspaces/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        await refreshAllWorkspaces();
      } catch {
        // ignore
      }
    },
    [backendUrlTrimmed, getAccessToken, refreshAllWorkspaces]
  );

  const value: WorkspaceContextValue = useMemo(
    () => ({
      workspaces,
      activeWorkspaceId: workspaceSummary?.id ?? null,
      activeWorkspace,
      loading: workspaceLoading,
      switching,
      error: null,
      hasWorkspaceHealthIssues,
      switchWorkspace,
      refreshWorkspaces,
      createWorkspace,
      deleteWorkspace,
    }),
    [
      workspaces,
      workspaceSummary?.id,
      activeWorkspace,
      workspaceLoading,
      switching,
      hasWorkspaceHealthIssues,
      switchWorkspace,
      refreshWorkspaces,
      createWorkspace,
      deleteWorkspace,
    ]
  );

  return <WorkspaceContextBridge value={value}>{children}</WorkspaceContextBridge>;
}
