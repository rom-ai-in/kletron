"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Panel,
  Button,
  SearchInput,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@numezis/ui/components/design-system";
import { History } from "lucide-react";

type HistoryRunItem = {
  id: string;
  type: "explore" | "deep_agent" | "graph" | "campaign" | "drift";
  title: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  link: string;
  graphId?: string;
  graphName?: string;
  campaignId?: string;
  workspaceId: string;
};

type FilterType = "all" | "explore" | "deep_agent" | "graph" | "campaign" | "drift";

const typeOptions: Array<{ id: FilterType; label: string }> = [
  { id: "all", label: "All" },
  { id: "explore", label: "Explore" },
  { id: "deep_agent", label: "Deep Agents" },
  { id: "drift", label: "Drift" },
  { id: "graph", label: "Graphs" },
  { id: "campaign", label: "Campaigns" },
];

const statusOptions = ["all", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "PAUSED", "PENDING", "active", "archived"] as const;

const statusStyles: Record<string, string> = {
  RUNNING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  FAILED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  CANCELLED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  PAUSED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PENDING: "bg-zinc-400/10 text-zinc-300 border-zinc-400/20",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export default function HistoryPage() {
  const searchParams = useSearchParams();
  const initialType = (searchParams?.get("type") as FilterType) || "all";
  const graphIdParam = searchParams?.get("graphId") || "";
  const campaignIdParam = searchParams?.get("campaignId") || "";

  const [runs, setRuns] = useState<HistoryRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>(initialType);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (query) params.set("q", query);
      if (graphIdParam) params.set("graphId", graphIdParam);
      if (campaignIdParam) params.set("campaignId", campaignIdParam);
      params.set("limit", "100");

      const res = await fetch(`/api/history/runs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load history");
      const data = (await res.json()) as { runs: HistoryRunItem[] };
      setRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, query, graphIdParam, campaignIdParam]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  const filteredRuns = useMemo(() => runs, [runs]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">History</h1>
            <p className="text-sm text-text-muted">
              Unified history across Explore, Deep Agents, Drift, Graphs, and Campaigns.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void fetchRuns()} variant="secondary" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-border-subtle bg-bg-surface px-6 py-3">
        <SearchInput
          placeholder="Search by title or ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          className="flex-1"
        />
        <div className="flex gap-2">
          {typeOptions.map((opt) => (
            <Button
              key={opt.id}
              size="sm"
              variant={typeFilter === opt.id ? "primary" : "secondary"}
              onClick={() => setTypeFilter(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-xs text-text-secondary"
        >
          {statusOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "all" ? "All statuses" : opt}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-elegant p-6 text-text-primary">
        {loading && <LoadingState message="Loading history..." />}
        {error && <ErrorState message={error} onRetry={() => void fetchRuns()} />}

        {!loading && !error && filteredRuns.length === 0 && (
          <EmptyState
            title="No history yet"
            description="Start a run in Explore, Deep Agents, or Campaigns to see it here."
            variant="no-data"
          />
        )}

        {!loading && !error && filteredRuns.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              <div className="col-span-2">Title</div>
              <div>Type</div>
              <div>Status</div>
              <div>Started</div>
              <div className="text-right">Action</div>
            </div>
            {filteredRuns.map((run) => (
              <Panel key={run.id} className="group p-4 transition hover:border-border-strong hover:bg-state-hover">
                <div className="grid grid-cols-6 gap-4 items-center">
                  <div className="col-span-2">
                    <div className="text-sm font-semibold text-text-primary truncate">{run.title}</div>
                    <div className="text-[10px] font-mono text-text-muted truncate">{run.id}</div>
                  </div>
                  <div>
                    <Badge variant="outline">{run.type.replace("_", " ")}</Badge>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusStyles[run.status] ?? "border-border-subtle text-text-muted"}`}
                    >
                      {run.status}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary">
                    {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                  </div>
                  <div className="text-right">
                    <Link href={run.link} className="text-xs font-semibold text-text-secondary hover:text-text-primary">
                      Open
                    </Link>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
