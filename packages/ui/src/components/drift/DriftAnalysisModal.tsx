"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Loader2, X, ShieldAlert, ShieldCheck, ClipboardCopy } from "lucide-react";
import { Modal, Button } from "@numezis/ui/components/design-system";
import type { LlmConfig, LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";
import { DEFAULT_DRIFT_STAGES } from "@numezis/shared/driftStages";

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
    systemPrompt?: string;
    resolvedLlm?: {
        provider: LlmProviderType;
        model?: string;
        azure?: { deployment?: string; endpoint?: string; apiVersion?: string };
        lmstudio?: { baseUrl?: string };
    };
};

type DriftResultRow = {
    stageId: string;
    stageName: string;
    driftDetected: boolean;
    argumentation: string;
    remediationPlan?: string;
    confidence?: number;
    timestamp: string;
};

type DriftResultsResponse = { total: number; rows: DriftResultRow[]; error?: string };

type Step = "review" | "running" | "results";

export type DriftAnalysisModalProps = {
    open: boolean;
    onClose: () => void;
};

const PROVIDER_LABELS: Record<LlmProviderType, string> = {
    azure: "Azure OpenAI",
    openai: "OpenAI",
    claude: "Claude",
    gemini: "Gemini",
    lmstudio: "LM Studio",
    ollama: "Ollama",
};

const fmtPct = (n: number) => `${Math.max(0, Math.min(100, Math.round(n)))}%`;
const DEFAULT_SYSTEM_PROMPT = `You are a Code Drift Analyzer.
You will receive:
- "Stage": the check group name to evaluate.
- "Git Diff": recent uncommitted changes.

Determine if the diff violates or drifts from the stage expectations.
Respond with JSON only:
{
  "driftDetected": boolean,
  "argumentation": "string",
  "remediationPlan": "string (optional)",
  "confidence": number (optional, 0..1)
}
`;

export function DriftAnalysisModal({
    open,
    onClose,
}: DriftAnalysisModalProps) {
    const [step, setStep] = useState<Step>("review");
    const [llmConfig, setLlmConfig] = useState<LlmConfig | null>(null);
    const [enabledProviders, setEnabledProviders] = useState<LlmProviderType[]>([]);
    const [provider, setProvider] = useState<LlmProviderType | "">("");
    const [healthStatus, setHealthStatus] = useState<"none" | "loading" | "success" | "error">("none");
    const [healthMessage, setHealthMessage] = useState<string | null>(null);
    const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
    const stageLabels = useMemo(() => DEFAULT_DRIFT_STAGES.map((stage) => stage.name), []);

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
        setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        setHealthStatus("none");
        setHealthMessage(null);
        setProvider("");

        void (async () => {
            try {
                const [configRes, enabledRes] = await Promise.all([
                    fetch("/api/llm-config"),
                    fetch("/api/llm-config/enable"),
                ]);
                if (configRes.ok) {
                    setLlmConfig((await configRes.json()) as LlmConfig);
                }
                if (enabledRes.ok) {
                    const enabledJson = await enabledRes.json();
                    setEnabledProviders((enabledJson?.enabledProviders ?? []) as LlmProviderType[]);
                }
            } catch { }
        })();
    }, [open]);

    const hasProviderConfig = (config: LlmConfig | null, p: LlmProviderType) => {
        const data = (config as any)?.[p];
        if (!data) return false;
        switch (p) {
            case "azure":
                return Boolean(data.endpoint && data.deployment && data.apiVersion && data.model);
            case "openai":
            case "claude":
            case "gemini":
                return Boolean(data.model);
            case "lmstudio":
                return Boolean(data.baseUrl && data.model);
            case "ollama":
                return Boolean(data.baseUrl && data.model);
            default:
                return false;
        }
    };

    const availableProviders = useMemo(() => {
        const enabled = enabledProviders.length
            ? enabledProviders
            : (llmConfig?.enabledProviders ?? []);
        const candidates = enabled.length
            ? enabled
            : (llmConfig?.provider ? [llmConfig.provider] : []);
        return candidates.filter((p) => hasProviderConfig(llmConfig, p));
    }, [enabledProviders, llmConfig]);

    useEffect(() => {
        if (!open) return;
        if (provider && availableProviders.includes(provider)) return;
        if (llmConfig?.provider && availableProviders.includes(llmConfig.provider)) {
            setProvider(llmConfig.provider);
            return;
        }
        setProvider(availableProviders[0] ?? "");
    }, [availableProviders, llmConfig, open, provider]);

    const checkHealth = async (selectedProvider: LlmProviderType) => {
        const providerConfig = (llmConfig as any)?.[selectedProvider];
        if (!providerConfig) {
            setHealthStatus("error");
            setHealthMessage("No configuration found for this provider.");
            return;
        }
        setHealthStatus("loading");
        setHealthMessage(null);
        try {
            const res = await fetch("/api/llm-config/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: selectedProvider,
                    config: providerConfig,
                }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Connection failed");
            setHealthStatus("success");
            setHealthMessage(`Connected. Latency: ${result.latency ?? "?"}ms`);
        } catch (e) {
            setHealthStatus("error");
            setHealthMessage((e as Error).message || "Connection failed");
        }
    };

    useEffect(() => {
        if (!provider) {
            setHealthStatus("none");
            setHealthMessage(null);
            return;
        }
        void checkHealth(provider as LlmProviderType);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provider, llmConfig]);

    const startJob = async () => {
        setJobError(null);
        setStep("running");
        setJob(null);
        setJobId(null);

        if (!provider) {
            setJobError("Please select a provider.");
            setStep("review");
            return;
        }
        if (healthStatus !== "success") {
            setJobError(healthMessage || "LLM health check failed.");
            setStep("review");
            return;
        }

        const llmSelection = {
            provider,
        };
        const normalizedSystemPrompt = systemPrompt.trim();

        try {
            const res = await fetch("/api/drift/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    llmSelection,
                    systemPrompt: normalizedSystemPrompt.length > 0 ? normalizedSystemPrompt : undefined,
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
            const canStart = Boolean(provider) && healthStatus === "success";
            return (
                <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                    <Button
                        variant="primary"
                        onClick={startJob}
                        disabled={!canStart || availableProviders.length === 0}
                    >
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
    }, [step, onClose, jobId, startJob, provider, healthStatus, availableProviders.length]);

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
                            This agent will analyze <b>all uncommitted changes (git diff)</b> against <b>{stageLabels.length} check groups</b>.
                        </div>
                        <div className="mt-2 text-xs text-text-muted">
                            It will process stages sequentially and report any drift or violations detected.
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {stageLabels.map((label) => (
                                <span
                                    key={label}
                                    className="rounded-full border border-border-subtle bg-bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-muted"
                                >
                                    {label}
                                </span>
                            ))}
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
                                    {availableProviders.length === 0 && (
                                        <option value="">No active LLMs</option>
                                    )}
                                    {availableProviders.map((p) => (
                                        <option key={p} value={p}>{PROVIDER_LABELS[p] ?? p}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="text-[11px] text-text-muted">
                            {healthStatus === "loading" && (
                                <span className="inline-flex items-center gap-1 text-text-secondary">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Checking LLM health...
                                </span>
                            )}
                            {healthStatus === "success" && (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                    <Check className="h-3 w-3" /> {healthMessage ?? "Connected"}
                                </span>
                            )}
                            {healthStatus === "error" && (
                                <span className="inline-flex items-center gap-1 text-rose-400">
                                    <X className="h-3 w-3" /> {healthMessage ?? "Connection failed"}
                                </span>
                            )}
                            {healthStatus === "none" && (
                                <span>Select an active LLM to run the health check.</span>
                            )}
                        </div>
                        <label className="text-xs text-text-secondary">
                            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                                <span>System Prompt</span>
                                <button
                                    type="button"
                                    className="rounded border border-border-subtle px-2 py-0.5 text-[10px] text-text-muted hover:bg-bg-surface"
                                    onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                                >
                                    Reset
                                </button>
                            </div>
                            <textarea
                                className="h-40 w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-primary focus:border-border-strong focus:outline-none"
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                spellCheck={false}
                            />
                            <div className="mt-2 text-[11px] text-text-muted">
                                Visible and editable. Overrides the default drift analysis system prompt.
                            </div>
                        </label>
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
                                className={`${job ? "bg-emerald-500/60" : "w-1/3 animate-pulse bg-emerald-500/40"} h-full transition-all duration-300`}
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
                                            return `${r.stageName} - ${status}\nArgumentation: ${r.argumentation}` + (r.remediationPlan ? `\nRemediation: ${r.remediationPlan}` : "");
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
                                                <div className="text-[10px] text-text-muted font-mono">{r.stageId}</div>
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
