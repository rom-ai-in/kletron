"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Loader2, X, ShieldAlert, ShieldCheck, ClipboardCopy } from "lucide-react";
import { Modal } from "@/src/components/ui/Modal";
import { Button } from "@/src/components/ui/Button";

type DriftJobStatus = {
    status: "queued" | "running" | "success" | "error" | "cancelled";
    startedAt?: string;
    finishedAt?: string;
    totalStages: number;
    processedStages: number;
    currentStageIndex: number;
    error?: string;
    log?: string[];
    llmSelection?: { provider?: string; model?: string };
    resolvedLlm?: {
        provider: "azure" | "lmstudio";
        model?: string;
        azure?: { deployment?: string; endpoint?: string; apiVersion?: string };
        lmstudio?: { baseUrl?: string };
    };
};

type DriftResultRow = {
    stageId: string;
    stageName: string;
    promptPath: string;
    driftDetected: boolean;
    argumentation: string;
    remediationPlan?: string;
    confidence?: number;
    timestamp: string;
};

type DriftResultsResponse = { total: number; rows: DriftResultRow[]; error?: string };

type EnvInfo = {
    llm?: {
        defaultProvider?: "azure" | "lmstudio";
        azure?: { configured: boolean; model?: string | null };
        lmstudio?: { configured: boolean; model?: string | null };
    };
};

type Step = "review" | "running" | "results";

export type DriftAnalysisModalProps = {
    open: boolean;
    onClose: () => void;
};

const fmtPct = (n: number) => `${Math.max(0, Math.min(100, Math.round(n)))}%`;

export function DriftAnalysisModal({
    open,
    onClose,
}: DriftAnalysisModalProps) {
    const [step, setStep] = useState<Step>("review");
    const [env, setEnv] = useState<EnvInfo | null>(null);
    const [provider, setProvider] = useState<"azure" | "lmstudio" | "default">("default");
    const [model, setModel] = useState<string>("");

    const [jobId, setJobId] = useState<string | null>(null);
    const [job, setJob] = useState<DriftJobStatus | null>(null);
    const [jobError, setJobError] = useState<string | null>(null);

    const [onlyDetected, setOnlyDetected] = useState(false); // Default to showing all
    const [results, setResults] = useState<DriftResultRow[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);

    // Fetch Env on open
    useEffect(() => {
        if (!open) return;
        setStep("review");
        setJobId(null);
        setJob(null);
        setJobError(null);
        setResults([]);
        setOnlyDetected(false);

        void (async () => {
            try {
                const envRes = await fetch("/api/env");
                if (envRes.ok) setEnv((await envRes.json()) as EnvInfo);
            } catch { }
        })();
    }, [open]);

    const configuredProviders = useMemo(() => {
        const opts: Array<{ id: "azure" | "lmstudio"; label: string }> = [];
        if (env?.llm?.azure?.configured) opts.push({ id: "azure", label: "Azure OpenAI" });
        if (env?.llm?.lmstudio?.configured) opts.push({ id: "lmstudio", label: "LM Studio" });
        return opts;
    }, [env]);

    const startJob = async () => {
        setJobError(null);
        setStep("running");
        setJob(null);
        setJobId(null);

        const llmSelection = provider === "default" ? undefined : {
            provider,
            model: model.trim() || undefined,
        };

        try {
            const res = await fetch("/api/drift/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ llmSelection }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to start job");
            setJobId(String(json.jobId));
        } catch (e) {
            setJobError((e as Error).message);
            setStep("review");
        }
    };

    const cancelJob = async () => {
        if (!jobId) return;
        try {
            await fetch("/api/drift/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId }),
            });
        } catch { }
    };

    // Poll status
    useEffect(() => {
        if (!open || step !== "running" || !jobId) return;
        let cancelled = false;
        const poll = async () => {
            try {
                const res = await fetch(`/api/drift/status?jobId=${encodeURIComponent(jobId)}`);
                const json = (await res.json());
                if (!res.ok) throw new Error(json.error || "Failed to fetch status");
                if (cancelled) return;

                setJob(json);
                if (json.status === "error") {
                    setJobError(json.error || "Job failed");
                    setStep("review");
                    return;
                }
                if (json.status === "cancelled") {
                    setJobError("Job cancelled.");
                    setStep("results");
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
        const id = window.setInterval(() => void poll(), 1500);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, [jobId, open, step]);


    const fetchResults = async () => {
        if (!jobId) return;
        setLoadingResults(true);
        try {
            const res = await fetch(
                `/api/drift/results?jobId=${encodeURIComponent(jobId)}&onlyDetected=${onlyDetected ? "true" : "false"}`
            );
            const json = await res.json() as DriftResultsResponse;
            if (!res.ok) throw new Error(json.error);
            setResults(json.rows || []);
        } catch (e) {
            // ignore
        } finally {
            setLoadingResults(false);
        }
    };

    useEffect(() => {
        if (step === "results") {
            void fetchResults();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, onlyDetected]);


    const footer = useMemo(() => {
        if (step === "review") {
            return (
                <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                    <Button variant="primary" onClick={startJob}>
                        Run Drift Analysis
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            );
        }
        if (step === "running") {
            return (
                <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-text-muted font-mono truncate">
                        {jobId ? `job ${jobId.slice(0, 8)}…` : "starting…"}
                    </div>
                    <Button variant="secondary" onClick={cancelJob} disabled={!jobId}>
                        Cancel
                    </Button>
                </div>
            );
        }
        return (
            <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>
        );
    }, [step, onClose, jobId, startJob]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Drift Analyzer Agent"
            subtitle={step === "review" ? "Start Analysis" : step === "running" ? "Running Analysis" : "Analysis Results"}
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

                    <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
                        <div className="text-sm font-medium text-text-primary mb-2">Scope</div>
                        <div className="text-xs text-text-secondary">
                            This agent will analyze <b>all uncommitted changes (git diff)</b> against <b>16 audit suites</b> (Security, I18n, UX, Architecture, etc.).
                        </div>
                        <div className="mt-2 text-xs text-text-muted">
                            It will process prompts sequentially and report any drift or violations detected.
                        </div>
                    </div>

                    <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4 space-y-3">
                        <div className="text-sm font-medium text-text-primary">Configuration</div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label className="text-xs text-text-secondary">
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Provider</div>
                                <select
                                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value as any)}
                                >
                                    <option value="default">Default (configured)</option>
                                    {configuredProviders.map((p) => (
                                        <option key={p.id} value={p.id}>{p.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-xs text-text-secondary">
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Model (Optional)</div>
                                <input
                                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                                    placeholder="e.g. gpt-4"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    disabled={provider === "default"}
                                />
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {step === "running" && (
                <div className="space-y-4">
                    <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
                        <div className="flex items-center justify-between text-sm">
                            <div className="font-medium text-text-primary">Analyzing...</div>
                            <div className="text-xs text-text-muted font-mono">
                                {(job?.processedStages ?? 0)}/{(job?.totalStages ?? "?")}
                            </div>
                        </div>
                        <div className="mt-3 h-2 w-full overflow-hidden rounded bg-black/20">
                            <div
                                className={`${job ? "bg-sky-500/60" : "w-1/3 animate-pulse bg-sky-500/40"} h-full transition-all duration-300`}
                                style={
                                    job && job.totalStages
                                        ? { width: fmtPct((job.processedStages / job.totalStages) * 100) }
                                        : undefined
                                }
                            />
                        </div>
                        <div className="mt-2 text-[11px] text-text-muted">
                            Processing stage: <span className="font-mono text-text-secondary">Stage {job?.currentStageIndex ? job.currentStageIndex + 1 : 1}</span>
                        </div>
                    </div>

                    <div className="rounded-lg border border-border-subtle bg-bg-elevated overflow-hidden">
                        <div className="border-b border-border-subtle bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary">
                            Live Log
                        </div>
                        <div className="max-h-[260px] overflow-auto scrollbar-elegant p-4 space-y-1">
                            {(job?.log ?? []).length === 0 ? (
                                <div className="text-xs text-text-muted flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Starting...
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
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-text-primary">Findings</div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                                <input type="checkbox" checked={onlyDetected} onChange={(e) => setOnlyDetected(e.target.checked)} />
                                Show only violations
                            </label>
                            <button
                                type="button"
                                className="flex items-center gap-1 rounded bg-bg-elevated px-2 py-1 text-xs text-text-primary hover:bg-bg-surface"
                                onClick={async () => {
                                    const filtered = results.filter((r) => !onlyDetected || r.driftDetected);
                                    const text = filtered
                                        .map((r) => {
                                            const status = r.driftDetected ? "DRIFT" : "PASS";
                                            return `${r.stageName} (${r.promptPath}) - ${status}\nArgumentation: ${r.argumentation}` + (r.remediationPlan ? `\nRemediation: ${r.remediationPlan}` : "");
                                        })
                                        .join("\n\n");
                                    try {
                                        await navigator.clipboard.writeText(text);
                                    } catch (e) {
                                        console.error("Copy failed", e);
                                    }
                                }}
                            >
                                <ClipboardCopy className="h-3 w-3" /> Copy
                            </button>
                        </div>
                    </div>

                    <div className="rounded-lg border border-border-subtle bg-bg-elevated overflow-hidden">
                        <div className="max-h-[500px] overflow-auto scrollbar-elegant divide-y divide-border-subtle">
                            {loadingResults ? (
                                <div className="p-4 text-center text-xs text-text-muted">Loading results...</div>
                            ) : results.length === 0 ? (
                                <div className="p-4 text-center text-xs text-text-muted">No results found (try unchecking filter).</div>
                            ) : (
                                results.map((r, i) => (
                                    <div key={i} className="p-4">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div>
                                                <div className="text-xs font-semibold text-text-primary">{r.stageName}</div>
                                                <div className="text-[10px] text-text-muted font-mono">{r.promptPath}</div>
                                            </div>
                                            {r.driftDetected ? (
                                                <span className="flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                                                    <ShieldAlert className="h-3 w-3" /> Drift
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                                    <ShieldCheck className="h-3 w-3" /> Pass
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-2 pl-4 border-l-2 border-border-subtle">
                                            <div className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                                                <span className="font-semibold text-text-muted uppercase text-[10px]">Argumentation:</span>
                                                <div className="mt-1">{r.argumentation}</div>
                                            </div>
                                            {r.driftDetected && r.remediationPlan && (
                                                <div className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                                                    <span className="font-semibold text-text-muted uppercase text-[10px]">Remediation:</span>
                                                    <div className="mt-1 bg-bg-surface p-2 rounded border border-border-subtle">{r.remediationPlan}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
