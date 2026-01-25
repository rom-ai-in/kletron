
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, RefreshCw, Upload, Search, AlertTriangle, ChevronDown, Check, Download } from "lucide-react";
import Link from "next/link";
import { Button } from "@/src/components/ui/Button";
import type { I18nStatus, TranslationRecord } from "@/src/services/i18nTranslationsService";
import { TranslationProcessModal } from "@/src/components/i18n/TranslationProcessModal";

type ListResponse = { total: number; rows: TranslationRecord[]; error?: string };
type ImportStartResponse = { success: boolean; jobId?: string; error?: string; errors?: string[] };
type ImportJobStatus = {
  status: "running" | "success" | "error";
  phase?: "queued" | "parsing" | "importing";
  replaceAll?: boolean;
  startedAt?: string;
  finishedAt?: string;
  totalRows?: number;
  processedRows?: number;
  upserted?: number;
  modified?: number;
  inserted?: number;
  error?: string;
};

export default function I18nPage() {
  const [rows, setRows] = useState<TranslationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [namespace, setNamespace] = useState("");
  const [status, setStatus] = useState<I18nStatus | "">("");
  const [reviewed, setReviewed] = useState<"" | "unreviewed" | "reviewed">("unreviewed");
  const [pageLimit, setPageLimit] = useState<number>(200);

  const [file, setFile] = useState<File | null>(null);
  const [replaceAll, setReplaceAll] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importJob, setImportJob] = useState<ImportJobStatus | null>(null);
  const [importExpanded, setImportExpanded] = useState(false);
  const importCollapseTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  type SelectionMode = "explicit" | "allMatching";
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("explicit");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set());
  const [excludedRowKeys, setExcludedRowKeys] = useState<Set<string>>(() => new Set());
  const [processOpen, setProcessOpen] = useState(false);
  const EXCLUSION_CAP = 5000;
  const [processSelection, setProcessSelection] = useState<
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
      }
    | null
  >(null);

  const load = async (overrides?: { pageLimit?: number }) => {
    setLoading(true);
    try {
      const limitToUse = overrides?.pageLimit ?? pageLimit;
      const params = new URLSearchParams();
      params.set("limit", String(limitToUse));
      if (q.trim()) params.set("q", q.trim());
      if (namespace.trim()) params.set("namespace", namespace.trim());
      if (status) params.set("status", status);
      if (reviewed === "reviewed") params.set("reviewed", "true");
      if (reviewed === "unreviewed") params.set("reviewed", "false");

      const res = await fetch(`/api/i18n/list?${params.toString()}`);
      const json = (await res.json()) as ListResponse;
      if (!res.ok) throw new Error(json.error || "Failed to load translations");
      setRows(json.rows || []);
      setTotal(json.total || 0);
    } catch (e) {
      setImportResult((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRows = useMemo(() => rows, [rows]);

  // Clear selection when dataset changes (refresh/filter).
  useEffect(() => {
    setSelectedRowKeys(new Set());
    setExcludedRowKeys(new Set());
    setSelectionMode("explicit");
  }, [rows]);

  const selectedCount = useMemo(() => {
    if (selectionMode === "allMatching") return Math.max(0, total - excludedRowKeys.size);
    return selectedRowKeys.size;
  }, [excludedRowKeys.size, selectedRowKeys.size, selectionMode, total]);

  const isRowSelected = (rowKey: string) => {
    if (selectionMode === "allMatching") return !excludedRowKeys.has(rowKey);
    return selectedRowKeys.has(rowKey);
  };

  const isAllVisibleSelected = useMemo(() => {
    if (visibleRows.length === 0) return false;
    for (const r of visibleRows) {
      const key = `${r.namespace}.${r.key}`;
      if (!isRowSelected(key)) return false;
    }
    return true;
  }, [isRowSelected, visibleRows]);

  const toggleRowSelected = (rowKey: string) => {
    if (selectionMode === "allMatching") {
      setExcludedRowKeys((prev) => {
        const next = new Set(prev);
        if (next.has(rowKey)) {
          next.delete(rowKey);
        } else {
          // Keep exclusions bounded so we don't send huge payloads to the API.
          if (next.size >= EXCLUSION_CAP) return next;
          next.add(rowKey);
        }
        return next;
      });
      return;
    }
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (selectionMode === "allMatching") {
      setExcludedRowKeys((prev) => {
        const next = new Set(prev);
        if (isAllVisibleSelected) {
          // Unselect all visible (exclude them)
          for (const r of visibleRows) next.add(`${r.namespace}.${r.key}`);
        } else {
          // Select all visible (remove from exclusions)
          for (const r of visibleRows) next.delete(`${r.namespace}.${r.key}`);
        }
        return next;
      });
      return;
    }
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (isAllVisibleSelected) {
        // Unselect all visible
        for (const r of visibleRows) next.delete(`${r.namespace}.${r.key}`);
      } else {
        // Select all visible
        for (const r of visibleRows) next.add(`${r.namespace}.${r.key}`);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectionMode("explicit");
    setSelectedRowKeys(new Set());
    setExcludedRowKeys(new Set());
  };

  const canSelectAllMatching = useMemo(() => {
    return selectionMode === "explicit" && total > 0;
  }, [selectionMode, total]);

  const selectAllMatching = () => {
    setSelectionMode("allMatching");
    setSelectedRowKeys(new Set());
    setExcludedRowKeys(new Set());
  };

  const openProcessModal = () => {
    if (selectionMode === "allMatching") {
      const qTrim = q.trim();
      const nsTrim = namespace.trim();
      const preview = visibleRows.slice(0, 50);
      setProcessSelection({
        mode: "query",
        q: qTrim || undefined,
        namespace: nsTrim || undefined,
        status: status || undefined,
        reviewed: reviewed === "reviewed" ? true : reviewed === "unreviewed" ? false : undefined,
        excludeRowKeys: Array.from(excludedRowKeys),
        estimatedSelected: selectedCount,
        previewRows: preview,
      });
      setProcessOpen(true);
      return;
    }

    const keys = Array.from(selectedRowKeys);
    const keySet = new Set(keys);
    const preview = visibleRows.filter((r) => keySet.has(`${r.namespace}.${r.key}`));
    setProcessSelection({ mode: "keys", rowKeys: keys, previewRows: preview });
    setProcessOpen(true);
  };

  const clearCollapseTimer = () => {
    if (importCollapseTimerRef.current) {
      window.clearTimeout(importCollapseTimerRef.current);
      importCollapseTimerRef.current = null;
    }
  };

  const pollImportJob = async (jobId: string) => {
    const res = await fetch(`/api/i18n/import/status?jobId=${encodeURIComponent(jobId)}`);
    const json = (await res.json()) as ImportJobStatus & { error?: string };
    if (!res.ok) throw new Error((json as any).error || "Failed to read import status");
    setImportJob(json);
    return json;
  };

  const onImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportJob(null);
    setImportJobId(null);
    setImportExpanded(true); // auto-expand on start
    clearCollapseTimer();
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("replaceAll", String(replaceAll));

      const res = await fetch("/api/i18n/import", { method: "POST", body: form });
      const json = (await res.json()) as ImportStartResponse;
      if (!res.ok) {
        const details = Array.isArray(json.errors) ? `\n${json.errors.slice(0, 20).join("\n")}` : "";
        throw new Error((json.error || "Import failed") + details);
      }
      if (!json.jobId) throw new Error("Import started but no jobId returned");

      setImportJobId(json.jobId);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setImportResult("Import queued…");

      // Poll until done
      const startedAt = Date.now();
      while (true) {
        const status = await pollImportJob(json.jobId);
        const phase = status.phase || "queued";
        const processed = status.processedRows ?? 0;
        const totalRows = status.totalRows;

        if (status.status === "error") {
          setImportExpanded(true); // auto-expand on error
          throw new Error(status.error || "Import failed");
        }
        if (status.status === "success") {
          setImportResult(
            `Imported ${totalRows ?? processed} rows. upserted=${status.upserted ?? 0}, modified=${status.modified ?? 0}, inserted=${
              status.inserted ?? 0
            }`
          );
          await load();
          // Auto-collapse shortly after success (keeps success pill visible in header).
          clearCollapseTimer();
          importCollapseTimerRef.current = window.setTimeout(() => {
            setImportExpanded(false);
          }, 2500);
          break;
        }

        // Update message while running
        if (typeof totalRows === "number" && totalRows > 0) {
          setImportResult(`${phase}… ${processed}/${totalRows}`);
        } else {
          setImportResult(`${phase}… ${processed} processed`);
        }

        // Safety: stop polling after 10 minutes
        if (Date.now() - startedAt > 10 * 60 * 1000) {
          setImportResult("Import is taking a long time. You can keep this page open or refresh later.");
          break;
        }

        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 800));
      }
    } catch (e) {
      setImportResult((e as Error).message);
      setImportExpanded(true); // auto-expand on error
    } finally {
      setImporting(false);
    }
  };

  const progressPct = useMemo(() => {
    const totalRows = importJob?.totalRows ?? 0;
    const processed = importJob?.processedRows ?? 0;
    if (!importing) return null;
    if (!totalRows) return null;
    return Math.max(0, Math.min(100, Math.round((processed / totalRows) * 100)));
  }, [importJob?.processedRows, importJob?.totalRows, importing]);

  const importStatus = useMemo(() => {
    const hasError =
      (importJob?.status === "error" && !!importJob?.error) ||
      (typeof importResult === "string" && /failed|error/i.test(importResult));
    const hasSuccess = typeof importResult === "string" && importResult.startsWith("Imported ");
    const phase = importJob?.phase ?? (importing ? "queued" : undefined);
    const processed = importJob?.processedRows ?? 0;
    const totalRows = importJob?.totalRows;

    if (importing) {
      const right = typeof totalRows === "number" ? `${processed}/${totalRows}` : `${processed}`;
      return {
        tone: "running" as const,
        label: `Importing… ${right}${phase ? ` (${phase})` : ""}`,
      };
    }

    if (hasError) {
      return { tone: "error" as const, label: "Import failed" };
    }

    if (hasSuccess) {
      // Keep it short in header.
      const match = importResult?.match(/Imported\s+(\d+)\s+rows/i);
      const n = match?.[1];
      return { tone: "success" as const, label: n ? `Imported ${n}` : "Imported" };
    }

    if (file) {
      const kb = Math.round(file.size / 1024);
      return { tone: "ready" as const, label: `${file.name} (${kb} KB)` };
    }

    return { tone: "idle" as const, label: "No file selected" };
  }, [file, importJob?.error, importJob?.phase, importJob?.processedRows, importJob?.status, importJob?.totalRows, importing, importResult]);

  useEffect(() => {
    if (!importExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImportExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [importExpanded]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="shrink-0 flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">I18n (DB)</h1>
            <p className="text-sm text-text-muted">CSV import + database-backed translation list</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/i18n/logs">
            <Button variant="secondary" size="sm">
              Logs
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.location.href = "/api/i18n/export";
            }}
            title="Export all translations as CSV (unfiltered)"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-b border-border-subtle bg-bg-surface px-6 py-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px_160px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              className="w-full rounded-md border border-border-subtle bg-bg-elevated pl-10 pr-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-border-strong focus:outline-none"
              placeholder="Search (key / namespace / values / source_file)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <input
            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-border-strong focus:outline-none"
            placeholder="Namespace filter (exact)"
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
          />
          <select
            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
            value={status}
            onChange={(e) => setStatus((e.target.value as any) || "")}
          >
            <option value="">All</option>
            <option value="active">active</option>
            <option value="unused">unused</option>
          </select>
          <select
            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
            value={reviewed}
            onChange={(e) => setReviewed((e.target.value as any) || "")}
            title="Reviewed filter"
          >
            <option value="">All</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="reviewed">Reviewed</option>
          </select>
          <Button variant="primary" onClick={() => void load()} disabled={loading}>
            Apply
          </Button>
        </div>

        {/* Selection controls (in filters area) */}
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-text-muted">
            <span className="font-semibold text-text-primary">{selectedCount}</span> selected
            {selectionMode === "allMatching" && excludedRowKeys.size > 0 ? (
              <span className="text-text-muted"> ({excludedRowKeys.size.toLocaleString()} excluded)</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleSelectAllVisible}
              disabled={visibleRows.length === 0}
              title="Select/unselect all rows currently visible in the table"
            >
              {isAllVisibleSelected ? "Unselect page" : "Select page"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={selectAllMatching}
              disabled={!canSelectAllMatching || selectionMode === "allMatching"}
              title="Select all rows matching the current filters (including beyond the current page)"
            >
              Select all matching ({total.toLocaleString()})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={selectedCount === 0}
              title="Clear selection"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Import panel (collapsible) */}
        <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated">
          <button
            type="button"
            className="w-full text-left"
            onClick={() => {
              clearCollapseTimer();
              setImportExpanded((v) => !v);
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-surface">
              <div className="flex min-w-0 items-center gap-3">
                <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${importExpanded ? "rotate-180" : ""}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary">Import CSV</div>
                  <div className="text-xs text-text-muted truncate">CSV → DB</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {replaceAll && (
                  <span className="hidden sm:inline-flex rounded-full border border-border-subtle bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Replace all
                  </span>
                )}
                <span
                  className={`max-w-[320px] truncate rounded-full px-2.5 py-1 text-xs font-medium ${
                    importStatus.tone === "running"
                      ? "bg-sky-500/15 text-sky-300"
                      : importStatus.tone === "success"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : importStatus.tone === "error"
                          ? "bg-rose-500/15 text-rose-300"
                          : importStatus.tone === "ready"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-bg-elevated text-text-secondary border border-border-subtle"
                  }`}
                  title={importStatus.label}
                >
                  {importStatus.label}
                </span>
              </div>
            </div>
            {/* Progress line in header when collapsed */}
            {!importExpanded && importing && (
              <div className="h-1 w-full bg-black/20">
                <div
                  className={`${progressPct === null ? "w-1/3 animate-pulse bg-sky-500/40" : "bg-sky-500/60"}`}
                  style={progressPct === null ? undefined : { width: `${progressPct}%` }}
                />
              </div>
            )}
          </button>

          {/* Collapsed quick actions */}
          {!importExpanded && (
            <div className="px-4 py-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-xs text-text-muted">
                  Expected:{" "}
                  <span className="font-mono">
                    key, namespace, source_file, context_usage, en, de, fr, it, status
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,text/csv,text/tab-separated-values"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      if (f) {
                        clearCollapseTimer();
                        setImportExpanded(true); // auto-expand on file selection
                      }
                    }}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    Choose file
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onImport();
                    }}
                    disabled={!file || importing}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Expanded content */}
          {importExpanded && (
            <div className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-text-primary">Import CSV into DB</div>
                  <div className="text-xs text-text-muted">
                    Expected columns:{" "}
                    <span className="font-mono">key, namespace, source_file, context_usage, en, de, fr, it, status</span>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={replaceAll}
                    onChange={(e) => {
                      e.stopPropagation();
                      setReplaceAll(e.target.checked);
                    }}
                  />
                  Replace all existing rows
                </label>
              </div>

              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,text/csv,text/tab-separated-values"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    if (f) {
                      clearCollapseTimer();
                      setImportExpanded(true);
                    }
                  }}
                  className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-md file:border-0 file:bg-bg-surface file:px-4 file:py-2 file:text-sm file:font-medium file:text-text-primary hover:file:bg-bg-elevated"
                />
                <Button variant="primary" onClick={onImport} disabled={!file || importing}>
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? "Importing..." : "Import"}
                </Button>
              </div>

              {importing && (
                <div className="mt-3 rounded-md border border-border-subtle bg-bg-surface px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>
                      Job:{" "}
                      <span className="font-mono">{importJobId ? importJobId.slice(0, 10) + "…" : "starting…"}</span>
                    </span>
                    <span className="font-mono">
                      {(importJob?.processedRows ?? 0).toString()}
                      {typeof importJob?.totalRows === "number" ? ` / ${importJob.totalRows}` : ""}{" "}
                      {importJob?.phase ? `(${importJob.phase})` : ""}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded bg-black/20">
                    <div
                      className={`h-full ${progressPct === null ? "w-1/3 animate-pulse bg-sky-500/40" : "bg-sky-500/60"}`}
                      style={progressPct === null ? undefined : { width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {importResult && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-secondary whitespace-pre-wrap">
                  {importResult.toLowerCase().includes("failed") || importResult.toLowerCase().includes("error") ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-400" />
                  ) : (
                <Check className="mt-0.5 h-4 w-4 text-emerald-400" />
                  )}
                  <span>{importResult}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Page stays scrollable; table also scrolls internally */}
      <div className="p-6 pb-10">
        <div className="mb-3 flex items-center justify-between text-xs text-text-muted">
          <span>
            Showing <span className="font-mono">{visibleRows.length}</span> / <span className="font-mono">{total}</span>{" "}
            rows (API limit {pageLimit})
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline">Tip: scroll inside the table (vertical + horizontal)</span>
            <span className="mx-2 hidden md:inline text-border-subtle">|</span>
            <label className="flex items-center gap-2">
              <span className="hidden md:inline">Rows per page</span>
              <select
                className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary focus:border-border-strong focus:outline-none"
                value={pageLimit}
                onChange={(e) => {
                  const next = Number.parseInt(e.target.value, 10);
                  setPageLimit(next);
                  void load({ pageLimit: next });
                }}
                title="Rows per page"
              >
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1,000</option>
                <option value={5000}>5,000</option>
              </select>
            </label>
          </div>
        </div>

        <div className="h-[75vh] min-h-[520px] overflow-hidden rounded-lg border border-border-strong bg-bg-surface shadow-sm flex flex-col">
          {/* Selection toolbar */}
          {selectedCount > 0 && (
            <div className="shrink-0 flex items-center justify-between border-b border-border-subtle bg-bg-elevated px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">{selectedCount}</span> selected
                <button
                  className="ml-2 text-xs text-sky-400 hover:text-sky-300"
                  onClick={clearSelection}
                  type="button"
                >
                  Clear
                </button>
                {selectionMode === "allMatching" && excludedRowKeys.size > 0 && (
                  <span className="text-text-muted">
                    ({excludedRowKeys.size.toLocaleString()} excluded)
                  </span>
                )}
                {canSelectAllMatching && (
                  <button
                    className="ml-3 text-xs text-sky-400 hover:text-sky-300"
                    onClick={selectAllMatching}
                    type="button"
                    title={`Select all ${total.toLocaleString()} matching rows`}
                  >
                    Select all matching ({total.toLocaleString()})
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={openProcessModal}>
                  Process
                </Button>
              </div>
            </div>
          )}

          {/* Scroll container: table scrolls, not the page */}
          <div
            className="flex-1 overflow-auto scrollbar-elegant"
            // Prevent the vertical scrollbar from overlaying the last column (Status).
            style={{ scrollbarGutter: "stable both-edges" } as React.CSSProperties}
          >
            {/* Table content: force horizontal scrolling when needed */}
            <div className="min-w-[1800px]">
              <div className="sticky top-0 z-10 grid grid-cols-[44px_280px_160px_320px_380px_260px_260px_260px_260px_110px_90px] border-b border-border-strong bg-bg-elevated text-xs font-semibold uppercase tracking-wider text-text-muted shadow-sm">
                <div className="px-3 py-2 border-r border-border-subtle flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible rows"
                  />
                </div>
                <div className="px-3 py-2 border-r border-border-subtle">key</div>
                <div className="px-3 py-2 border-r border-border-subtle">namespace</div>
                <div className="px-3 py-2 border-r border-border-subtle">source_file</div>
                <div className="px-3 py-2 border-r border-border-subtle">context_usage</div>
                <div className="px-3 py-2 border-r border-border-subtle">en</div>
                <div className="px-3 py-2 border-r border-border-subtle">de</div>
                <div className="px-3 py-2 border-r border-border-subtle">fr</div>
                <div className="px-3 py-2 border-r border-border-subtle">it</div>
                <div className="px-3 py-2 border-r border-border-subtle">status</div>
                <div className="px-3 py-2">reviewed</div>
              </div>

              <div className="divide-y divide-border-subtle">
                {loading ? (
                  <div className="px-4 py-6 text-sm text-text-muted">Loading…</div>
                ) : visibleRows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-text-muted">No rows found.</div>
                ) : (
                  visibleRows.map((r, idx) => {
                    const rowKey = `${r.namespace}.${r.key}`;
                    const zebra = idx % 2 === 0 ? "bg-bg-surface" : "bg-bg-elevated";
                    const cellBase = "px-3 py-2 text-xs text-text-primary leading-snug";
                    const clipped = "max-h-[3.25rem] overflow-hidden";
                    const isSelected = isRowSelected(rowKey);
                    const isReviewed = Boolean((r as any).reviewed);

                    return (
                      <div
                        key={rowKey}
                        role="row"
                        aria-selected={isSelected}
                        onClick={() => toggleRowSelected(rowKey)}
                        className={`grid grid-cols-[44px_280px_160px_320px_380px_260px_260px_260px_260px_110px_90px] ${zebra} hover:bg-state-hover cursor-pointer ${
                          isSelected ? "ring-1 ring-inset ring-focusRing" : ""
                        }`}
                      >
                        <div
                          className="px-3 py-2 border-r border-border-subtle flex items-center justify-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleRowSelected(rowKey);
                            }}
                            aria-label={`Select ${rowKey}`}
                          />
                        </div>
                        <div className={`${cellBase} border-r border-border-subtle font-mono text-[11px] text-text-primary`}>
                          <div className="truncate" title={r.key}>
                            {r.key}
                          </div>
                        </div>
                        <div className={`${cellBase} border-r border-border-subtle font-mono text-[11px] text-text-muted`}>
                          <div className="truncate" title={r.namespace}>
                            {r.namespace}
                          </div>
                        </div>
                        <div className={`${cellBase} border-r border-border-subtle font-mono text-[11px] text-text-muted`}>
                          <div className="truncate" title={r.source_file}>
                            {r.source_file}
                          </div>
                        </div>
                        <div className={`${cellBase} border-r border-border-subtle font-mono text-[11px] text-text-muted`}>
                          <div className="truncate" title={r.context_usage || ""}>
                            {r.context_usage || ""}
                          </div>
                        </div>
                        <div className={`${cellBase} border-r border-border-subtle`}>
                          <div className={`${clipped} whitespace-pre-wrap`} title={r.en || ""}>
                            {r.en || ""}
                          </div>
                        </div>
                        <div className={`${cellBase} border-r border-border-subtle`}>
                          <div className={`${clipped} whitespace-pre-wrap`} title={r.de || ""}>
                            {r.de || ""}
                          </div>
                        </div>
                        <div className={`${cellBase} border-r border-border-subtle`}>
                          <div className={`${clipped} whitespace-pre-wrap`} title={r.fr || ""}>
                            {r.fr || ""}
                          </div>
                        </div>
                        <div className={`${cellBase} border-r border-border-subtle`}>
                          <div className={`${clipped} whitespace-pre-wrap`} title={r.it || ""}>
                            {r.it || ""}
                          </div>
                        </div>
                        <div className="px-3 py-2 border-r border-border-subtle">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              r.status === "active"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-amber-500/15 text-amber-400"
                            }`}
                          >
                            {r.status || "unknown"}
                          </span>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-center">
                          {isReviewed ? <Check className="h-4 w-4 text-emerald-400" /> : <span className="text-text-muted">—</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {processSelection && (
        <TranslationProcessModal
          open={processOpen}
          onClose={() => setProcessOpen(false)}
          selection={processSelection}
          onApplied={async () => {
            await load();
            clearSelection();
          }}
        />
      )}
    </div>
  );
}
