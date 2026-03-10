'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type WorkspaceSummary = {
  id: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  provider?: string;
  defaultBranch?: string;
  status?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  lastUsed?: string | Date;
  health?: "healthy" | "missing" | "inaccessible";
  healthMessage?: string | null;
  selectable?: boolean;
};

interface WorkspaceContextValue {
  /** All active workspaces for the current user */
  workspaces: WorkspaceSummary[];
  /** The currently active workspace ID */
  activeWorkspaceId: string | null;
  /** The currently active workspace object (convenience) */
  activeWorkspace: WorkspaceSummary | null;
  /** Whether workspace data is loading */
  loading: boolean;
  /** Error message from the last workspace operation (null if none) */
  error: string | null;
  /** True when at least one workspace is unhealthy */
  hasWorkspaceHealthIssues: boolean;
  /** Switch the active workspace (calls API, updates local state) */
  switchWorkspace: (id: string) => Promise<void>;
  /** Refresh the workspace list from the server */
  refreshWorkspaces: () => Promise<void>;
  /** Create a new workspace */
  createWorkspace: (input: { rootPath: string; name?: string; repoUrl?: string }) => Promise<WorkspaceSummary | null>;
  /** Delete (archive) a workspace */
  deleteWorkspace: (id: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  /** Monotonic counter to guard against stale workspace-switch responses */
  const switchCounterRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces?t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to load workspaces');
      const data = await res.json();
      if (!mountedRef.current) return;
      const list: WorkspaceSummary[] = Array.isArray(data.workspaces) ? data.workspaces : [];
      setWorkspaces(list);
      setActiveWorkspaceId(data.activeWorkspaceId ?? list[0]?.id ?? null);
    } catch (e) {
      console.error('[WorkspaceContext] Failed to fetch workspaces:', e);
      if (mountedRef.current) setError((e as Error).message ?? 'Failed to load workspaces');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  // Periodic health revalidation for stale/moved workspace paths.
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshWorkspaces();
    }, 60_000);
    return () => clearInterval(interval);
  }, [refreshWorkspaces]);

  useEffect(() => {
    const onFocus = () => void refreshWorkspaces();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshWorkspaces]);

  const switchWorkspace = useCallback(async (id: string) => {
    if (!id || id === activeWorkspaceId) return;
    // Increment counter; only the latest call will apply its result
    const myCounter = ++switchCounterRef.current;
    const previousId = activeWorkspaceId;
    // Optimistic update — set immediately so React state is correct
    // before the API call completes. This prevents stale workspaceId
    // from being sent when creating new sessions.
    setActiveWorkspaceId(id);
    try {
      const res = await fetch(`/api/workspaces/${id}/select`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).message || (err as Record<string, string>).error || 'Failed to select workspace');
      }
      if (!mountedRef.current) return;
      // If a newer switch happened while we were waiting, don't touch state
      if (switchCounterRef.current !== myCounter) return;
      // API confirmed — state is already correct (optimistic)
    } catch (e) {
      console.error('[WorkspaceContext] Failed to switch workspace:', e);
      if (mountedRef.current && switchCounterRef.current === myCounter) {
        // Revert optimistic update on failure
        setActiveWorkspaceId(previousId);
        setError((e as Error).message ?? 'Failed to switch workspace');
      }
    }
  }, [activeWorkspaceId]);

  const createWorkspace = useCallback(async (input: { rootPath: string; name?: string; repoUrl?: string }): Promise<WorkspaceSummary | null> => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error || 'Failed to create workspace');
      }
      const data = await res.json();
      if (!mountedRef.current) return null;
      const ws: WorkspaceSummary = data.workspace;
      // Refresh list to include the new workspace
      await refreshWorkspaces();
      return ws;
    } catch (e) {
      console.error('[WorkspaceContext] Failed to create workspace:', e);
      return null;
    }
  }, [refreshWorkspaces]);

  const deleteWorkspace = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete workspace');
      if (!mountedRef.current) return;
      // Refresh list and update active if necessary
      await refreshWorkspaces();
    } catch (e) {
      console.error('[WorkspaceContext] Failed to delete workspace:', e);
    }
  }, [refreshWorkspaces]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const hasWorkspaceHealthIssues = workspaces.some((w) => (w.health ?? "healthy") !== "healthy");

  // Track if we've already attempted auto-recovery for the current activeWorkspaceId
  const autoRecoveryAttemptedRef = useRef<string | null>(null);

  // Auto-recovery: if active workspace is unhealthy, switch to the first healthy workspace.
  useEffect(() => {
    if (!activeWorkspaceId || !workspaces.length) return;
    const current = workspaces.find((w) => w.id === activeWorkspaceId);
    if (!current) return;
    const currentHealthy = (current.health ?? "healthy") === "healthy" && current.selectable !== false;
    if (currentHealthy) {
      autoRecoveryAttemptedRef.current = null;
      return;
    }

    // Prevent infinite loop if the fallback post fails and it reverts the activeWorkspaceId
    if (autoRecoveryAttemptedRef.current === activeWorkspaceId) return;

    const nextHealthy = workspaces.find((w) => (w.health ?? "healthy") === "healthy" && w.selectable !== false);
    if (!nextHealthy || nextHealthy.id === activeWorkspaceId) return;

    autoRecoveryAttemptedRef.current = activeWorkspaceId;
    void switchWorkspace(nextHealthy.id);
  }, [activeWorkspaceId, workspaces, switchWorkspace]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        activeWorkspace,
        loading,
        error,
        hasWorkspaceHealthIssues,
        switchWorkspace,
        refreshWorkspaces,
        createWorkspace,
        deleteWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
