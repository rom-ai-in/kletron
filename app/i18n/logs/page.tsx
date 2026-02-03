"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

import { AlertTriangle, Check, ClipboardCopy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/design-system";

type JobListItem = {
  id: string;
  status: "queued" | "running" | "success" | "error" | "cancelled";
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
  totalRows: number;
  processedRows: number;
  nextIndex?: number;
  chunkSize: number;
  error?: string;
  resolvedLlm?: {
    provider: "azure" | "lmstudio";
    model?: string;
    azure?: { deployment?: string; endpoint?: string; apiVersion?: string };
    lmstudio?: { baseUrl?: string };
  };
  log?: string[];
};

type JobsResponse = { total: number; jobs: JobListItem[]; error?: string };
type StatusResponse = JobListItem & { error?: string; log?: string[] };
type ResultsResponse = { total: number; rows: any[]; error?: string };

function fmtDate(d?: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

function I18nLogsPageContent() {
  const searchParams = useSearchParams();
  const selectedJobId = searchParams?.get("jobId") || "";

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [job, setJob] = useState<StatusResponse | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [onlyUpdates, setOnlyUpdates] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [resultsOffset, setResultsOffset] = useState(0);
  const [loadingResults, setLoadingResults] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const [cancellingJob, setCancellingJob] = useState(false);

  const loadJobs = async () => {
    setLoadingJobs(true);
    setJobsError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/i18n/process/jobs?${params.toString()}`);
      const json = (await res.json()) as JobsResponse;
      if (!res.ok) throw new Error(json.error || "Failed to load jobs");
      setJobs(json.jobs || []);
      setJobsTotal(json.total || 0);
    } catch (e) {
      setJobsError((e as Error).message);
    } finally {
      setLoadingJobs(false);
    }
  };

  const loadJob = async (jobId: string) => {
    if (!jobId) return;
    setLoadingJob(true);
    setJobError(null);
    try {
      const res = await fetch(`/api/i18n/process/status?jobId=${encodeURIComponent(jobId)}`);
      const json = (await res.json()) as StatusResponse;
      if (!res.ok) throw new Error((json as any).error || "Failed to load job");
      setJob(json);
    } catch (e) {
      setJobError((e as Error).message);
      setJob(null);
    } finally {
      setLoadingJob(false);
    }
  };

  const loadResults = async (jobId: string, opts?: { reset?: boolean }) => {
    if (!jobId) return;
    const reset = opts?.reset ?? false;
    setLoadingResults(true);
    try {
      const nextOffset = reset ? 0 : resultsOffset;
      const res = await fetch(
        `/api/i18n/process/results?jobId=${encodeURIComponent(jobId)}&onlyChanged=${onlyUpdates ? "true" : "false"}&limit=200&offset=${nextOffset}`
      );
      const json = (await res.json()) as ResultsResponse;
      if (!res.ok) throw new Error(json.error || "Failed to load results");
      setResultsTotal(json.total || 0);
      setResultsOffset(nextOffset + (json.rows?.length || 0));
      setResults((prev) => (reset ? json.rows : [...prev, ...(json.rows || [])]));
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedJobId) {
      setJob(null);
      return;
    }
    void loadJob(selectedJobId);
    setResults([]);
    setResultsOffset(0);
    void loadResults(selectedJobId, { reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;
    setResults([]);
    setResultsOffset(0);
    void loadResults(selectedJobId, { reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyUpdates]);

  // Auto-poll selected running job
  useEffect(() => {
    if (!selectedJobId) return;
    if (!job || job.status !== "running") return;
    const id = window.setInterval(() => void loadJob(selectedJobId), 1500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, job?.status]);

  const llmLabel = useMemo(() => {
    const r = job?.resolvedLlm;
    if (!r) return "";
    const base = r.provider + (r.model ? `/${r.model}` : "");
    if (r.provider === "lmstudio" && r.lmstudio?.baseUrl) return `${base} (${r.lmstudio.baseUrl})`;
    if (r.provider === "azure" && r.azure?.deployment) return `${base} (deployment ${r.azure.deployment})`;
    return base;
  }, [job?.resolvedLlm]);

  const copyJobId = async () => {
    if (!selectedJobId) return;
    try {
      await navigator.clipboard.writeText(selectedJobId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const applyAllUpdates = async () => {
    if (!selectedJobId) return;
    setApplyingAll(true);
    setJobError(null);
    try {
      const res = await fetch("/api/i18n/process/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId, mode: "all_updates" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as any)?.error || "Failed to apply updates");
      }
      await loadJob(selectedJobId);
      setResults([]);
      setResultsOffset(0);
      await loadResults(selectedJobId, { reset: true });
    } catch (e) {
      setJobError((e as Error).message);
    } finally {
      setApplyingAll(false);
    }
  };

  const resumeJob = async (opts?: { force?: boolean }) => {
    if (!selectedJobId) return;
    const force = opts?.force ?? false;
    const res = await fetch("/api/i18n/process/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: selectedJobId, force }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const msg = (json as any)?.error || "Failed to resume job";
      setJobError(msg);
      return;
    }
    await loadJob(selectedJobId);
  };

  const cancelJob = async () => {
    if (!selectedJobId) return;
    setCancellingJob(true);
    setJobError(null);
    try {
      const res = await fetch("/api/i18n/process/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Failed to cancel job");
      await loadJob(selectedJobId);
    } catch (e) {
      setJobError((e as Error).message);
    } finally {
      setCancellingJob(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-text-primary">Translation Agent Logs</div>
          <div className="text-sm text-text-muted">All TranslationReAct jobs + details</div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/i18n">
            <Button variant="secondary" size="sm">Back</Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={loadJobs} disabled={loadingJobs}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingJobs ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: job list */}
        <div className="w-[420px] shrink-0 border-r border-border-subtle bg-bg-surface">
          <div className="p-4 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <div className="text-xs text-text-muted">
                Jobs: <span className="font-mono">{jobsTotal}</span>
              </div>
              <select
                className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="running">running</option>
                <option value="queued">queued</option>
                <option value="success">success</option>
                <option value="error">error</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            {jobsError && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-400" />
                <span>{jobsError}</span>
              </div>
            )}
          </div>

          <div className="max-h-full overflow-auto scrollbar-elegant">
            {loadingJobs ? (
              <div className="p-4 text-sm text-text-muted flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-4 text-sm text-text-muted">No jobs found.</div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {jobs.map((j) => {
                  const active = j.id === selectedJobId;
                  const pct = j.totalRows ? Math.round((j.processedRows / j.totalRows) * 100) : 0;
                  const badge =
                    j.status === "running"
                      ? "bg-sky-500/15 text-sky-300"
                      : j.status === "success"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : j.status === "error"
                          ? "bg-rose-500/15 text-rose-300"
                          : j.status === "cancelled"
                            ? "bg-zinc-500/15 text-zinc-300"
                            : "bg-bg-elevated text-text-secondary border border-border-subtle";

                  return (
                    <Link
                      key={j.id}
                      href={`/i18n/logs?jobId=${encodeURIComponent(j.id)}`}
                      className={`block px-4 py-3 transition ${active ? "bg-state-selected" : "hover:bg-state-hover"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-text-primary truncate">{j.id.slice(0, 10)}…</div>
                          <div className="mt-1 text-[11px] text-text-muted">
                            {fmtDate(j.createdAt)} • rows <span className="font-mono">{j.totalRows}</span> • chunk{" "}
                            <span className="font-mono">{j.chunkSize}</span>
                          </div>
                        </div>
                        <div className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${badge}`}>
                          {j.status}
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-black/20">
                        <div className={`h-full ${j.status === "running" ? "bg-sky-500/60" : "bg-white/10"}`} style={{ width: `${pct}%` }} />
                      </div>
                      {j.error ? (
                        <div className="mt-2 text-[11px] text-rose-300 line-clamp-2">{j.error}</div>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: job details */}
        <div className="flex-1 overflow-hidden bg-bg-app">
          {!selectedJobId ? (
            <div className="p-6 text-sm text-text-muted">Pick a job on the left to see details.</div>
          ) : (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="shrink-0 border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm text-text-primary truncate">{selectedJobId}</div>
                      <button
                        type="button"
                        onClick={copyJobId}
                        className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary"
                        title="Copy job id"
                      >
                        <ClipboardCopy className="h-3.5 w-3.5" />
                      </button>
                      {copied ? <span className="text-xs text-emerald-300">Copied</span> : null}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      {loadingJob ? "Loading…" : job ? `${job.status} • ${job.processedRows}/${job.totalRows}` : ""}
                      {llmLabel ? ` • ${llmLabel}` : ""}
                    </div>
                    <div className="mt-1 text-[11px] text-text-muted">
                      created {fmtDate(job?.createdAt)} {job?.startedAt ? `• started ${fmtDate(job.startedAt)}` : ""}{" "}
                      {job?.finishedAt ? `• finished ${fmtDate(job.finishedAt)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void loadJob(selectedJobId)} disabled={loadingJob}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${loadingJob ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void resumeJob({ force: false })}
                      disabled={!job || job.status !== "running"}
                      title="Re-queue a stuck running job so the worker picks it up again"
                    >
                      Resume
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void resumeJob({ force: true })}
                      disabled={!job || job.status !== "running"}
                      title="Force re-queue even if heartbeat looks recent"
                    >
                      Force resume
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={cancelJob}
                      disabled={
                        !job ||
                        !["running", "queued"].includes(job.status) ||
                        cancellingJob
                      }
                      title="Stop a running or queued job"
                    >
                      {cancellingJob ? "Cancelling…" : "Cancel job"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={applyAllUpdates}
                      disabled={
                        applyingAll ||
                        !job ||
                        !["success", "cancelled", "error"].includes(job.status) ||
                        resultsTotal === 0
                      }
                      title={
                        !job
                          ? "Select a job first"
                          : job.status === "running" || job.status === "queued"
                            ? "Cancel the job first, then apply the results that were already computed."
                            : resultsTotal === 0
                              ? "No UPDATE recommendations available to apply."
                              : job.status === "cancelled"
                                ? "Apply UPDATE recommendations computed so far."
                                : "Apply all UPDATE recommendations."
                      }
                    >
                      {applyingAll ? "Applying…" : "Apply all updates"}
                    </Button>
                  </div>
                </div>
                {jobError && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-rose-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-400" />
                    <span>{jobError}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-1 overflow-hidden">
                <div className="w-[520px] shrink-0 border-r border-border-subtle bg-bg-surface">
                  <div className="border-b border-border-subtle px-4 py-3 text-sm font-medium text-text-primary flex items-center justify-between">
                    <span>Live log</span>
                    {job?.status === "success" ? <Check className="h-4 w-4 text-emerald-400" /> : null}
                  </div>
                  <div className="max-h-full overflow-auto scrollbar-elegant p-4 space-y-1">
                    {(job?.log ?? []).length === 0 ? (
                      <div className="text-xs text-text-muted">No log lines.</div>
                    ) : (
                      (job?.log ?? []).slice().reverse().map((line, idx) => (
                        <div key={idx} className="text-xs font-mono text-text-secondary whitespace-pre-wrap">
                          {line}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="border-b border-border-subtle bg-bg-surface px-4 py-3 flex items-center justify-between">
                    <div className="text-sm font-medium text-text-primary">Results</div>
                    <label className="flex items-center gap-2 text-xs text-text-secondary">
                      <input type="checkbox" checked={onlyUpdates} onChange={(e) => setOnlyUpdates(e.target.checked)} />
                      Show only updates
                    </label>
                  </div>
                  <div className="max-h-full overflow-auto scrollbar-elegant">
                    {loadingResults && results.length === 0 ? (
                      <div className="p-4 text-sm text-text-muted flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading results…
                      </div>
                    ) : results.length === 0 ? (
                      <div className="p-4 text-sm text-text-muted">No results loaded.</div>
                    ) : (
                      <div className="divide-y divide-border-subtle">
                        {results.map((r: any) => (
                          <div key={r.rowKey} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-mono text-xs text-text-primary truncate">{r.rowKey}</div>
                                <div className="mt-1 text-xs text-text-secondary line-clamp-2">{r.rationale}</div>
                              </div>
                              <div className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${r.decision === "UPDATE"
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-bg-elevated text-text-secondary border border-border-subtle"
                                }`}>
                                {r.decision}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-border-subtle bg-bg-surface px-4 py-3 flex items-center justify-between">
                      <div className="text-xs text-text-muted">
                        Showing <span className="font-mono">{results.length}</span> / <span className="font-mono">{resultsTotal}</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void loadResults(selectedJobId, { reset: false })}
                        disabled={loadingResults || results.length >= resultsTotal}
                      >
                        {loadingResults ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading…
                          </>
                        ) : (
                          "Load more"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function I18nLogsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-text-muted">Loading...</div>}>
      <I18nLogsPageContent />
    </Suspense>
  );
}
