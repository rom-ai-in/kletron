import { useCallback, useEffect, useState } from "react";
import { Button } from "@kletron/ui/components/design-system";

export type HistoryRunRow = {
  id: string;
  type: string;
  title: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  link: string;
  graphId?: string;
  graphName?: string;
  automationId?: string;
  workspaceId: string;
};

type Props = {
  backendUrlTrimmed: string;
  backendReady: boolean;
  getAccessToken: () => Promise<string | null>;
  activeWorkspaceId: string | null;
  onOpenThread: (sessionId: string) => void;
  onOpenFullHistoryPortal: () => void;
};

export function HistoryPanel({
  backendUrlTrimmed,
  backendReady,
  getAccessToken,
  activeWorkspaceId,
  onOpenThread,
  onOpenFullHistoryPortal,
}: Props) {
  const [runs, setRuns] = useState<HistoryRunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!backendReady || !activeWorkspaceId) {
      setRuns([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      headers["x-workspace-id"] = activeWorkspaceId;
      const params = new URLSearchParams();
      params.set("workspaceId", activeWorkspaceId);
      params.set("limit", "100");
      const res = await fetch(`${backendUrlTrimmed}/api/history/runs?${params.toString()}`, { headers });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Failed to load history (${res.status})`);
      }
      const data = (await res.json()) as { runs?: HistoryRunRow[] };
      setRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to load history");
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [backendUrlTrimmed, backendReady, getAccessToken, activeWorkspaceId]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0 text-text-primary">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">History</h1>
          <p className="text-xs text-text-muted">Recent runs in this workspace. Open the full timeline in your browser.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="xs" variant="secondary" onClick={() => void fetchRuns()} disabled={loading}>
            Refresh
          </Button>
          <Button size="xs" variant="ghost" onClick={onOpenFullHistoryPortal}>
            Full history in browser
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-elegant">
        {!activeWorkspaceId && (
          <p className="text-sm text-text-muted">Select a workspace to load history.</p>
        )}
        {error && (
          <div className="mb-3 rounded border border-status-error-border bg-status-error-bg px-3 py-2 text-xs text-status-error-text">
            {error}
          </div>
        )}
        {loading && <p className="text-xs text-text-muted">Loading…</p>}
        {!loading && activeWorkspaceId && runs.length === 0 && !error && (
          <p className="text-sm text-text-muted">No history entries yet.</p>
        )}
        <ul className="space-y-2 max-w-3xl">
          {runs.map((r) => (
            <li
              key={`${r.type}-${r.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-surface/50 px-3 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-text-primary truncate">{r.title || r.id}</div>
                <div className="text-[10px] text-text-muted">
                  {r.type} · {r.status}
                  {r.startedAt ? ` · ${new Date(r.startedAt).toLocaleString()}` : ""}
                </div>
              </div>
              {r.type === "agent" && (
                <Button size="xs" variant="secondary" onClick={() => onOpenThread(r.id)}>
                  Open in agent
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
