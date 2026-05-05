'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY_PREFIX = 'kletron.threadRead.v1';

export type ThreadReadRow = { id: string; updatedAt?: string | null };

/**
 * Per-workspace read cursors for session threads (client-only).
 * Baselines missing ids from the session list so historical threads are not all treated as unread.
 */
export function useThreadReadCursors(workspaceId: string | null) {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!workspaceId) {
      setMap({});
      return;
    }
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}:${workspaceId}`);
      setMap(raw ? (JSON.parse(raw) as Record<string, string>) : {});
    } catch {
      setMap({});
    }
  }, [workspaceId]);

  const persist = useCallback((next: Record<string, string>) => {
    if (!workspaceId) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}:${workspaceId}`, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }, [workspaceId]);

  const syncBaseline = useCallback(
    (rows: ThreadReadRow[]) => {
      if (!workspaceId || rows.length === 0) return;
      setMap((prev) => {
        let next = prev;
        let changed = false;
        for (const row of rows) {
          if (!row.updatedAt) continue;
          if (next[row.id] === undefined) {
            if (!changed) {
              next = { ...prev };
              changed = true;
            }
            next[row.id] = row.updatedAt;
          }
        }
        if (changed) persist(next);
        return changed ? next : prev;
      });
    },
    [workspaceId, persist],
  );

  const markRead = useCallback(
    (sessionId: string, updatedAtIso: string) => {
      setMap((prev) => {
        const prevVal = prev[sessionId];
        if (prevVal && new Date(prevVal) >= new Date(updatedAtIso)) return prev;
        const next = { ...prev, [sessionId]: updatedAtIso };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const lastReadAt = useCallback((sessionId: string) => map[sessionId], [map]);

  return useMemo(
    () => ({ syncBaseline, markRead, lastReadAt }),
    [syncBaseline, markRead, lastReadAt],
  );
}
