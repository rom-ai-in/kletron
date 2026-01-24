"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Loader2, X } from "lucide-react";
import { Modal } from "@/src/components/ui/Modal";
import { Button } from "@/src/components/ui/Button";
import type { I18nStatus, TranslationRecord } from "@/src/services/i18nTranslationsService";

type ProcessJobStatus = {
  status: "queued" | "running" | "success" | "error" | "cancelled";
  startedAt?: string;
  finishedAt?: string;
  totalRows: number;
  processedRows: number;
  chunkSize: number;
  error?: string;
  log?: string[];
};

type ProcessResultRow = {
  rowKey: string;
  namespace: string;
  key: string;
  decision: "KEEP" | "UPDATE";
  confidence: number;
  rationale: string;
  changedLocales: Array<"en" | "de" | "fr" | "it">;
  original: { en: string; de: string; fr: string; it: string };
  proposed?: { en?: string; de?: string; fr?: string; it?: string };
};

type ResultsResponse = { total: number; rows: ProcessResultRow[]; error?: string };

type EnvInfo = {
  llm?: {
    defaultProvider?: "azure" | "lmstudio";
    azure?: { configured: boolean; model?: string | null };
    lmstudio?: { configured: boolean; model?: string | null };
  };
};

type Step = "review" | "running" | "results";

export type TranslationProcessModalProps = {
  open: boolean;
  onClose: () => void;
  selection:
    | { mode: "keys"; rowKeys: string[]; previewRows?: TranslationRecord[] }
    | {
        mode: "query";
        q?: string;
        namespace?: string;
        status?: I18nStatus;
        reviewed?: boolean;
        limit?: number;
        excludeRowKeys?: string[];
        estimatedSelected?: number;
        previewRows?: TranslationRecord[];
      };
  onApplied?: () => void;
};

const fmtPct = (n: number) => `${Math.max(0, Math.min(100, Math.round(n)))}%`;

export function TranslationProcessModal({
  open,
  onClose,
  selection,
  onApplied,
}: TranslationProcessModalProps) {
  const autoCloseTimerRef = useRef<number | null>(null);
  const [step, setStep] = useState<Step>("review");
  const [rowKeys, setRowKeys] = useState<string[]>([]);
  const [rows, setRows] = useState<TranslationRecord[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const [env, setEnv] = useState<EnvInfo | null>(null);
  const [provider, setProvider] = useState<"azure" | "lmstudio" | "default">("default");
  const [model, setModel] = useState<string>("");
  const [chunkSize, setChunkSize] = useState<number>(20);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ProcessJobStatus | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  const [onlyChanged, setOnlyChanged] = useState(true);
  const [results, setResults] = useState<ProcessResultRow[]>([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [resultsOffset, setResultsOffset] = useState(0);
  const [loadingResults, setLoadingResults] = useState(false);

  const [accepted, setAccepted] = useState<Set<string>>(() => new Set());
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Clear any previous timers when opening
    if (autoCloseTimerRef.current) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    // Reset modal state on open
    setStep("review");
    setRowKeys(selection.mode === "keys" ? selection.rowKeys : []);
    setJobId(null);
    setJob(null);
    setJobError(null);
    setOnlyChanged(true);
    setResults([]);
    setResultsTotal(0);
    setResultsOffset(0);
    setAccepted(new Set());
    setApplying(false);
    setApplyError(null);
    setApplySuccess(null);
    setAdvancedOpen(false);
    setProvider("default");
    setModel("");
    setChunkSize(20);

    // Seed preview immediately (then fetch canonical)
    setRows(selection.previewRows ?? []);
    setLoadingRows(true);
    void (async () => {
      try {
        const envRes = await fetch("/api/env");
        if (envRes.ok) setEnv((await envRes.json()) as EnvInfo);
      } catch {
        // ignore
      }
      try {
        if (selection.mode === "keys") {
          const res = await fetch("/api/i18n/translations/by-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rowKeys: selection.rowKeys }),
          });
          const json = await res.json();
          if (res.ok) setRows((json.rows || []) as TranslationRecord[]);
        } else {
          const params = new URLSearchParams();
          params.set("limit", "50");
          if (selection.q?.trim()) params.set("q", selection.q.trim());
          if (selection.namespace?.trim()) params.set("namespace", selection.namespace.trim());
          if (selection.status) params.set("status", selection.status);
          const res = await fetch(`/api/i18n/list?${params.toString()}`);
          const json = await res.json();
          if (res.ok) setRows((json.rows || []) as TranslationRecord[]);
        }
      } catch {
        // ignore
      } finally {
        setLoadingRows(false);
      }
    })();
  }, [open, selection]);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        window.clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

  const configuredProviders = useMemo(() => {
    const opts: Array<{ id: "azure" | "lmstudio"; label: string }> = [];
    if (env?.llm?.azure?.configured) opts.push({ id: "azure", label: "Azure OpenAI" });
    if (env?.llm?.lmstudio?.configured) opts.push({ id: "lmstudio", label: "LM Studio" });
    return opts;
  }, [env]);

  const canRun = (selection.mode === "query" || rowKeys.length > 0) && !loadingRows;

  const startJob = async () => {
    setJobError(null);
    setApplyError(null);
    setApplySuccess(null);
    setStep("running");
    setJob(null);
    setJobId(null);

    const llmSelection =
      provider === "default"
        ? undefined
        : {
            provider,
            model: model.trim() || undefined,
          };

    try {
      const res = await fetch("/api/i18n/process/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selection:
            selection.mode === "keys"
              ? { mode: "keys", rowKeys }
              : {
                  mode: "query",
                  q: selection.q,
                  namespace: selection.namespace,
                  status: selection.status,
                  reviewed: selection.reviewed,
                  limit: selection.limit,
                  excludeRowKeys: selection.excludeRowKeys ?? [],
                },
          chunkSize,
          llmSelection,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start job");
      setJobId(String(json.jobId));
    } catch (e) {
      setJobError((e as Error).message);
      setStep("review");
    }
  };

  // Poll status when running
  useEffect(() => {
    if (!open || step !== "running" || !jobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/i18n/process/status?jobId=${encodeURIComponent(jobId)}`);
        const json = (await res.json()) as ProcessJobStatus & { error?: string };
        if (!res.ok) throw new Error((json as any).error || "Failed to fetch status");
        if (cancelled) return;
        setJob(json);
        if (json.status === "error") {
          setJobError(json.error || "Job failed");
          setStep("review");
          return;
        }
        if (json.status === "cancelled") {
          setJobError("Job cancelled.");
          setStep("review");
          return;
        }
        if (json.status === "success") {
          setStep("results");
        }
      } catch (e) {
        if (cancelled) return;
        setJobError((e as Error).message);
        setStep("review");
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 1200);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jobId, open, step]);

  const fetchResults = async (opts?: { reset?: boolean }) => {
    if (!jobId) return;
    const reset = opts?.reset ?? false;
    setLoadingResults(true);
    setApplyError(null);
    try {
      const nextOffset = reset ? 0 : resultsOffset;
      const res = await fetch(
        `/api/i18n/process/results?jobId=${encodeURIComponent(jobId)}&onlyChanged=${onlyChanged ? "true" : "false"}&limit=200&offset=${nextOffset}`
      );
      const json = (await res.json()) as ResultsResponse;
      if (!res.ok) throw new Error(json.error || "Failed to fetch results");
      setResultsTotal(json.total || 0);
      setResultsOffset(nextOffset + (json.rows?.length || 0));
      setResults((prev) => (reset ? json.rows : [...prev, ...json.rows]));

      // Default accept UPDATE rows on first load/reset
      if (reset) {
        const next = new Set<string>();
        for (const r of json.rows) {
          if (r.decision === "UPDATE") next.add(r.rowKey);
        }
        setAccepted(next);
      }
    } catch (e) {
      setApplyError((e as Error).message);
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    if (!open || step !== "results" || !jobId) return;
    void fetchResults({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, jobId]);

  // When filter changes in results, refetch
  useEffect(() => {
    if (!open || step !== "results") return;
    setResults([]);
    setResultsOffset(0);
    void fetchResults({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyChanged]);

  const cancelJob = async () => {
    if (!jobId) return;
    try {
      await fetch("/api/i18n/process/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
    } catch {
      // ignore
    }
  };

  const toggleAccepted = (rk: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(rk)) next.delete(rk);
      else next.add(rk);
      return next;
    });
  };

  const acceptAll = () => {
    const next = new Set<string>();
    for (const r of results) {
      if (r.decision === "UPDATE") next.add(r.rowKey);
    }
    setAccepted(next);
  };
  const acceptNone = () => setAccepted(new Set());

  const applySelected = async () => {
    setApplying(true);
    setApplyError(null);
    setApplySuccess(null);
    try {
      const updates = results
        .filter((r) => r.decision === "UPDATE" && accepted.has(r.rowKey) && r.proposed)
        .map((r) => ({ rowKey: r.rowKey, proposed: r.proposed! }));

      if (!updates.length) {
        setApplyError("No updates selected.");
        return;
      }

      const res = await fetch("/api/i18n/translations/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to apply updates");

      setApplySuccess(`Applied ${updates.length} updates.`);
      if (onApplied) await Promise.resolve(onApplied());

      // Auto-close shortly after successful apply.
      if (autoCloseTimerRef.current) window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = window.setTimeout(() => {
        onClose();
      }, 900);
    } catch (e) {
      setApplyError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const reviewList = useMemo(() => {
    const map = new Map(rows.map((r) => [`${r.namespace}.${r.key}`, r]));
    return rowKeys
      .map((rk) => map.get(rk) ?? null)
      .filter(Boolean) as TranslationRecord[];
  }, [rowKeys, rows]);

  const footer = useMemo(() => {
    if (step === "review") {
      return (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-text-muted">
            {rowKeys.length} selected
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" onClick={startJob} disabled={!canRun}>
              Run Translation Agent
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }
    if (step === "running") {
      return (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-text-muted font-mono truncate">
            {jobId ? `job ${jobId.slice(0, 8)}…` : "starting…"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={cancelJob} disabled={!jobId}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>
            Showing <span className="font-mono">{results.length}</span> / <span className="font-mono">{resultsTotal}</span>
          </span>
          <span className="hidden md:inline">Accepted: <span className="font-mono">{accepted.size}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={acceptAll} disabled={!results.length}>
            Select all updates
          </Button>
          <Button variant="secondary" onClick={acceptNone} disabled={!results.length}>
            Select none
          </Button>
          <Button variant="primary" onClick={applySelected} disabled={applying || accepted.size === 0}>
            {applying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Apply selected
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }, [accepted.size, applying, canRun, jobId, onClose, results.length, resultsTotal, rowKeys.length, startJob, step]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="TranslationReAct"
      subtitle={step === "review" ? "Review selection" : step === "running" ? "Running agent" : "Review proposals"}
      footer={footer}
    >
      {step === "review" && (
        <div className="space-y-4">
          {jobError && (
            <div className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-rose-300 whitespace-pre-wrap">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-400" />
              <span>{jobError}</span>
            </div>
          )}

          <div className="rounded-lg border border-border-subtle bg-bg-elevated">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <div className="text-sm font-medium text-text-primary">Selected translations</div>
              <div className="text-xs text-text-muted">{rowKeys.length} rows</div>
            </div>
            <div className="max-h-[320px] overflow-auto scrollbar-elegant">
              {loadingRows && rows.length === 0 ? (
                <div className="px-4 py-4 text-sm text-text-muted flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : reviewList.length === 0 ? (
                <div className="px-4 py-4 text-sm text-text-muted">No rows selected.</div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {reviewList.map((r) => {
                    const rk = `${r.namespace}.${r.key}`;
                    return (
                      <div key={rk} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-text-primary truncate">{rk}</div>
                          <div className="mt-1 text-xs text-text-secondary line-clamp-2">{r.en || r.fr || r.de || r.it || ""}</div>
                          <div className="mt-1 text-[11px] text-text-muted font-mono truncate">{r.context_usage || r.source_file}</div>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-border-subtle px-2 py-1 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary"
                          onClick={() => setRowKeys((prev) => prev.filter((x) => x !== rk))}
                          title="Remove from run"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-bg-elevated overflow-hidden">
            <button
              type="button"
              className="w-full text-left px-4 py-3 border-b border-border-subtle bg-bg-surface flex items-center justify-between"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <div className="text-sm font-medium text-text-primary">Advanced</div>
              <div className="text-xs text-text-muted">{advancedOpen ? "Hide" : "Show"}</div>
            </button>
            {advancedOpen && (
              <div className="p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs text-text-secondary">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Chunk size</div>
                    <input
                      className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                      type="number"
                      min={5}
                      max={50}
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Math.max(5, Math.min(50, Number(e.target.value) || 20)))}
                    />
                    <div className="mt-1 text-[11px] text-text-muted">For 100+ rows, 15–25 is usually safest.</div>
                  </label>

                  <label className="text-xs text-text-secondary">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Provider</div>
                    <select
                      className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as any)}
                    >
                      <option value="default">Default (configured)</option>
                      {configuredProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-[11px] text-text-muted">
                      Default provider: <span className="font-mono">{env?.llm?.defaultProvider ?? "unknown"}</span>
                    </div>
                  </label>
                </div>

                <label className="text-xs text-text-secondary">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Model (optional)</div>
                  <input
                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                    placeholder="Leave empty to use configured default"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={provider === "default"}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "running" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="font-medium text-text-primary">Processing</div>
              <div className="text-xs text-text-muted font-mono">
                {(job?.processedRows ?? 0).toString()}/{(job?.totalRows ?? rowKeys.length).toString()}
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded bg-black/20">
              <div
                className={`${job ? "bg-sky-500/60" : "w-1/3 animate-pulse bg-sky-500/40"} h-full`}
                style={
                  job && job.totalRows
                    ? { width: fmtPct((job.processedRows / job.totalRows) * 100) }
                    : undefined
                }
              />
            </div>
            <div className="mt-2 text-[11px] text-text-muted">
              Chunk size: <span className="font-mono">{job?.chunkSize ?? chunkSize}</span>
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-bg-elevated overflow-hidden">
            <div className="border-b border-border-subtle bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary">
              Live log
            </div>
            <div className="max-h-[260px] overflow-auto scrollbar-elegant p-4 space-y-1">
              {(job?.log ?? []).length === 0 ? (
                <div className="text-xs text-text-muted flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Waiting for updates…
                </div>
              ) : (
                (job?.log ?? []).slice().reverse().map((line, idx) => (
                  <div key={idx} className="text-xs font-mono text-text-secondary">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {step === "results" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
              Show only updates
            </label>
            <div className="text-xs text-text-muted">
              Toggle rows to apply. The agent may keep already-good translations.
            </div>
          </div>

          {applyError && (
            <div className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-rose-300 whitespace-pre-wrap">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-400" />
              <span>{applyError}</span>
            </div>
          )}
          {applySuccess && (
            <div className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-emerald-300 whitespace-pre-wrap">
              <Check className="mt-0.5 h-4 w-4 text-emerald-400" />
              <span>{applySuccess}</span>
            </div>
          )}

          <div className="rounded-lg border border-border-subtle bg-bg-elevated overflow-hidden">
            <div className="border-b border-border-subtle bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary">
              Proposals
            </div>
            <div className="max-h-[520px] overflow-auto scrollbar-elegant">
              {loadingResults && results.length === 0 ? (
                <div className="px-4 py-4 text-sm text-text-muted flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading results…
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-4 text-sm text-text-muted">No results found.</div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {results.map((r) => {
                    const isUpdate = r.decision === "UPDATE";
                    const isAccepted = accepted.has(r.rowKey);
                    return (
                      <div key={r.rowKey} className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-text-primary truncate">{r.rowKey}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  isUpdate ? "bg-amber-500/15 text-amber-300" : "bg-bg-surface text-text-muted border border-border-subtle"
                                }`}
                              >
                                {r.decision}
                              </span>
                              <span className="text-[10px] text-text-muted font-mono">
                                conf={Math.round(r.confidence * 100)}%
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-text-secondary">{r.rationale}</div>
                            {r.changedLocales?.length ? (
                              <div className="mt-1 text-[11px] text-text-muted">
                                Changed: <span className="font-mono">{r.changedLocales.join(", ")}</span>
                              </div>
                            ) : null}
                          </div>

                          {isUpdate && (
                            <label className="shrink-0 flex items-center gap-2 text-xs text-text-secondary">
                              <input
                                type="checkbox"
                                checked={isAccepted}
                                onChange={() => toggleAccepted(r.rowKey)}
                              />
                              Apply
                            </label>
                          )}
                        </div>

                        {/* Old vs New */}
                        {isUpdate && (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {(["en", "de", "fr", "it"] as const).map((loc) => {
                              const oldVal = r.original[loc] ?? "";
                              const newVal = (r.proposed?.[loc] ?? oldVal) as string;
                              const changed = newVal !== oldVal;
                              return (
                                <div key={loc} className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
                                  <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2 bg-bg-elevated">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{loc}</div>
                                    <div className="text-[10px] text-text-muted">{changed ? "changed" : "unchanged"}</div>
                                  </div>
                                  <div className="p-3 space-y-2">
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wider text-text-muted">old</div>
                                      <div className="text-xs text-text-primary whitespace-pre-wrap">{oldVal}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wider text-text-muted">new</div>
                                      <div className={`text-xs whitespace-pre-wrap ${changed ? "text-emerald-200" : "text-text-secondary"}`}>
                                        {newVal}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-border-subtle bg-bg-surface px-4 py-3 flex items-center justify-between">
              <div className="text-xs text-text-muted">
                {results.length} / {resultsTotal}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void fetchResults({ reset: false })}
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
      )}
    </Modal>
  );
}

