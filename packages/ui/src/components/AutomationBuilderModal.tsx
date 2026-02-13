"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Skeleton, Panel, SelectableRow } from "@numezis/ui/components/design-system";
import { AutomationConfigBuilder } from "@numezis/shared/automationConfigBuilder";
import type { AutomationDefinition, AutomationStageConfig, AutomationTriggerType, GitEventType } from "@numezis/shared/automationTypes";
import type { LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";
import { describeCron } from "@numezis/shared/cronUtils";

type GraphOption = { id: string; name: string; description?: string };
type LlmProviderOption = { id: LlmProviderType; label: string; model?: string };

/** Display labels for each provider. */
const PROVIDER_LABELS: Record<string, string> = {
    azure: "Azure OpenAI",
    openai: "OpenAI",
    claude: "Claude",
    gemini: "Gemini",
    lmstudio: "LM Studio",
    ollama: "Ollama",
    vllm: "vLLM",
};

const TRIGGER_OPTIONS: { id: AutomationTriggerType; label: string; description: string }[] = [
    { id: "manual", label: "Manual", description: "Triggered manually from the UI" },
    { id: "schedule", label: "Schedule", description: "Runs on a cron schedule" },
    { id: "webhook", label: "Webhook", description: "Triggered by an HTTP POST" },
    { id: "git_event", label: "Git Event", description: "Triggered by git push, PR, or tag" },
];

const CRON_PRESETS: { label: string; value: string }[] = [
    { label: "Every hour", value: "0 * * * *" },
    { label: "Every 6 hours", value: "0 */6 * * *" },
    { label: "Daily at 2 AM", value: "0 2 * * *" },
    { label: "Daily at 9 AM", value: "0 9 * * *" },
    { label: "Weekly Mon 9 AM", value: "0 9 * * 1" },
    { label: "Custom", value: "" },
];

const COMMON_TIMEZONES = [
    "UTC",
    "Europe/London",
    "Europe/Paris",
    "Europe/Zurich",
    "Europe/Berlin",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
];

const GIT_EVENT_OPTIONS: { id: GitEventType; label: string }[] = [
    { id: "push", label: "Push" },
    { id: "pull_request", label: "Pull Request" },
    { id: "tag", label: "Tag" },
];

interface AutomationBuilderModalProps {
    open: boolean;
    onClose: () => void;
    /** Called when an automation is created or updated; receives the automation ID */
    onCreated: (automationId: string) => void;
    editAutomationId?: string;
}

type WizardStep = 1 | 2 | 3 | 4;

export function AutomationBuilderModal({ open, onClose, onCreated, editAutomationId }: AutomationBuilderModalProps) {
    const [step, setStep] = useState<WizardStep>(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [automationData, setAutomationData] = useState<Partial<AutomationDefinition>>({
        name: "",
        description: "",
        stages: [],
    });
    const [graphOptions, setGraphOptions] = useState<GraphOption[]>([]);
    const [llmProviderOptions, setLlmProviderOptions] = useState<LlmProviderOption[]>([]);

    // Fetch available agent graphs + enabled LLM providers
    useEffect(() => {
        let cancelled = false;
        const loadGraphs = async () => {
            try {
                const res = await fetch("/api/agent-graphs", { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json();
                const list = Array.isArray(data?.graphs) ? data.graphs : [];
                if (!cancelled) {
                    setGraphOptions(
                        list.map((g: any) => ({
                            id: g._id?.toString() || g.id || "",
                            name: g.name || "Unnamed Graph",
                            description: g.description || "",
                        }))
                    );
                }
            } catch {
                // Fallback to empty — the UI will still work, just with no options
            }
        };
        const loadProviders = async () => {
            try {
                // Fetch enabled providers
                const enableRes = await fetch("/api/llm-config/enable", { cache: "no-store" });
                const enableData = enableRes.ok ? await enableRes.json() : {};
                const enabled: LlmProviderType[] = Array.isArray(enableData.enabledProviders)
                    ? enableData.enabledProviders
                    : [];

                // Fetch full config to get model names for each provider
                const configRes = await fetch("/api/llm-config", { cache: "no-store" });
                const configData = configRes.ok ? await configRes.json() : {};

                if (!cancelled) {
                    setLlmProviderOptions(
                        enabled.map((providerId) => {
                            const cfg = configData?.[providerId] as Record<string, unknown> | undefined;
                            const model = (cfg?.model ?? cfg?.deployment ?? "") as string;
                            return {
                                id: providerId,
                                label: PROVIDER_LABELS[providerId] ?? providerId,
                                model: model || undefined,
                            };
                        })
                    );
                }
            } catch {
                // Fallback — show at least azure/lmstudio so the UI isn't empty
                if (!cancelled) {
                    setLlmProviderOptions([
                        { id: "azure", label: "Azure OpenAI" },
                        { id: "lmstudio", label: "LM Studio" },
                    ]);
                }
            }
        };
        void loadGraphs();
        void loadProviders();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const fetchExistingAutomation = async () => {
            if (!editAutomationId) return;
            setLoading(true);
            try {
                const res = await fetch(`/api/automations/${editAutomationId}`);
                if (res.ok) {
                    const data = await res.json();
                    const chain = data.automation ?? data.chain;
                    const normalizedStages = (chain?.stages || []).map((stage: AutomationStageConfig) => ({
                        ...stage,
                        prompt: stage.prompt ?? "",
                    }));
                    setAutomationData({ ...chain, stages: normalizedStages });
                    setStep(2); // Jump to configuration
                }
            } catch (err) {
                console.error("Failed to fetch automation:", err);
            } finally {
                setLoading(false);
            }
        };

        if (open) {
            if (editAutomationId) {
                void fetchExistingAutomation();
            } else {
                // Reset for new creation
                setStep(1);
                setAutomationData({ name: "", description: "", stages: [], triggerType: "manual" });
            }
        }
    }, [open, editAutomationId]);

    const presets = AutomationConfigBuilder.getPresetNames();

    const handleSelectPreset = (presetName: string) => {
        const preset = AutomationConfigBuilder.buildAutomation(presetName);
        setAutomationData({
            ...automationData,
            name: preset.name,
            description: preset.description,
            stages: preset.stages ? [...preset.stages] : [],
        });
        setStep(2);
    };

    const handleAddStage = () => {
        const defaultGraphId = graphOptions.length > 0 ? graphOptions[0].id : "";
        const defaultProvider: LlmProviderType = llmProviderOptions.length > 0 ? llmProviderOptions[0].id : "azure";
        const newStage: AutomationStageConfig = {
            id: `stage-${(automationData.stages?.length || 0) + 1}`,
            name: "New Stage",
            prompt: "",
            graphId: defaultGraphId,
            llmProvider: defaultProvider,
        };
        setAutomationData({
            ...automationData,
            stages: [...(automationData.stages || []), newStage],
        });
    };

    const handleRemoveStage = (index: number) => {
        const newStages = [...(automationData.stages || [])];
        newStages.splice(index, 1);
        setAutomationData({ ...automationData, stages: newStages });
    };

    const handleUpdateStage = (index: number, updates: Partial<AutomationStageConfig>) => {
        const newStages = [...(automationData.stages || [])];
        newStages[index] = { ...newStages[index], ...updates };
        setAutomationData({ ...automationData, stages: newStages });
    };

    const handleCreate = async () => {
        setLoading(true);
        setError("");
        try {
            const url = editAutomationId ? `/api/automations/${editAutomationId}` : "/api/automations";
            const method = editAutomationId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config: automationData }),
            });
            if (!res.ok) {
                const data = await res.json();
                let errorMessage = data.message || data.error || `Failed to ${editAutomationId ? "update" : "create"} automation`;

                if (data.details && Array.isArray(data.details)) {
                    // improve formatting of validation errors
                    const details = data.details
                        .map((d: any) => {
                            if (typeof d === 'string') return d;
                            if (d.path && Array.isArray(d.path)) {
                                return `${d.path.join('.')}: ${d.message}`;
                            }
                            return d.message;
                        })
                        .join(', ');
                    errorMessage += ` (${details})`;
                }

                throw new Error(errorMessage);
            }
            const data = await res.json();
            const automationId = data.automationId ?? data.chainId;
            onCreated(editAutomationId || automationId);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const promptIssues = (automationData.stages || [])
        .map((stage, index) => (!stage.prompt || stage.prompt.trim() === "" ? index : null))
        .filter((index) => index !== null) as number[];
    const hasPromptIssues = promptIssues.length > 0;

    const renderStep = () => {
        if (loading && editAutomationId && step === 1) {
            return (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-6 w-20" />
                    </div>
                    <div className="space-y-3">
                        <div className="space-y-3 p-3 border border-border-subtle rounded-lg">
                            <div className="flex justify-between gap-2">
                                <Skeleton className="h-5 w-1/3" />
                                <Skeleton className="h-4 w-12" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        </div>
                        <div className="space-y-3 p-3 border border-border-subtle rounded-lg">
                            <div className="flex justify-between gap-2">
                                <Skeleton className="h-5 w-1/3" />
                                <Skeleton className="h-4 w-12" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        switch (step) {
            case 1:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-text-secondary">
                            Start with a pre-configured template or build from scratch.
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                            {presets.map((p) => {
                                const meta = AutomationConfigBuilder.getPresetMetadata(p);
                                return (
                                    <SelectableRow
                                        key={p}
                                        label={meta?.name || p}
                                        subLabel={`${meta?.description} • ${meta?.stageCount} stages • ${meta?.estimatedDuration}`}
                                        onClick={() => handleSelectPreset(p)}
                                    />
                                );
                            })}
                            <SelectableRow
                                label="Custom Automation"
                                subLabel="Manually configure every audit stage and setting"
                                onClick={() => {
                                    setAutomationData({ name: "Custom Automation", description: "", stages: [] });
                                    setStep(2);
                                }}
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-text-primary">Configure Stages</h4>
                            <Button variant="secondary" size="xs" onClick={handleAddStage}>
                                + Add Stage
                            </Button>
                        </div>
                        {hasPromptIssues && (
                            <div className="rounded border border-status-warning-border bg-status-warning-bg px-3 py-2 text-[11px] text-status-warning-text">
                                {promptIssues.length} stage{promptIssues.length > 1 ? "s" : ""} missing a prompt. Add a prompt to continue.
                            </div>
                        )}
                        <div className="space-y-3">
                            {automationData.stages?.map((stage: AutomationStageConfig, idx: number) => (
                                <Panel
                                    key={idx}
                                    className={`space-y-3 p-3 text-xs border-border-subtle bg-bg-elevated/50 ${(!stage.prompt || stage.prompt.trim() === "") ? "border-status-error-border bg-status-error-bg" : ""}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <input
                                            value={stage.name}
                                            onChange={(e) => handleUpdateStage(idx, { name: e.target.value })}
                                            className="flex-1 bg-transparent border-none p-0 font-medium text-text-primary focus:ring-0"
                                            placeholder="Stage Name"
                                        />
                                        <button
                                            onClick={() => handleRemoveStage(idx)}
                                            className="text-text-muted hover:text-status-error-text"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] text-text-muted uppercase mb-1">Graph / Flow</label>
                                            <select
                                                value={stage.graphId}
                                                onChange={(e) => handleUpdateStage(idx, { graphId: e.target.value })}
                                                className="w-full rounded border-border-subtle bg-bg-surface px-2 py-1 text-xs"
                                            >
                                                {graphOptions.length === 0 && (
                                                    <option value="" disabled>Loading graphs...</option>
                                                )}
                                                {graphOptions.map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                                {/* If the current graphId isn't in the list (e.g. legacy), show it */}
                                                {stage.graphId && !graphOptions.some(g => g.id === stage.graphId) && (
                                                    <option value={stage.graphId}>{stage.graphId} (legacy)</option>
                                                )}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-text-muted uppercase mb-1">LLM Provider</label>
                                            <select
                                                value={stage.llmProvider}
                                                onChange={(e) => handleUpdateStage(idx, { llmProvider: e.target.value as LlmProviderType })}
                                                className="w-full rounded border-border-subtle bg-bg-surface px-2 py-1 text-xs"
                                            >
                                                {llmProviderOptions.length === 0 && (
                                                    <option value="" disabled>Loading providers...</option>
                                                )}
                                                {llmProviderOptions.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.label}{p.model ? ` (${p.model})` : ""}
                                                    </option>
                                                ))}
                                                {/* If the current provider isn't in the list (e.g. disabled), keep it visible */}
                                                {stage.llmProvider && !llmProviderOptions.some((p) => p.id === stage.llmProvider) && (
                                                    <option value={stage.llmProvider}>
                                                        {PROVIDER_LABELS[stage.llmProvider] ?? stage.llmProvider} (disabled)
                                                    </option>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-text-muted uppercase mb-1">Prompt</label>
                                        <textarea
                                            value={stage.prompt ?? ""}
                                            onChange={(e) => handleUpdateStage(idx, { prompt: e.target.value })}
                                            className="w-full min-h-[84px] rounded border-border-subtle bg-bg-surface px-2 py-1 text-xs"
                                            placeholder="Describe exactly what this stage should do..."
                                        />
                                        {(!stage.prompt || stage.prompt.trim() === "") && (
                                            <div className="mt-1 text-[10px] text-status-error-text">Prompt is required.</div>
                                        )}
                                    </div>
                                </Panel>
                            ))}
                            {automationData.stages?.length === 0 && (
                                <div className="py-8 text-center text-xs text-text-muted border border-dashed border-border-subtle rounded-md">
                                    No stages added. Add at least one stage to proceed.
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 3: {
                const currentTrigger: AutomationTriggerType = automationData.triggerType || "manual";
                const currentCron = automationData.schedule?.cron || "";
                const isPresetCron = CRON_PRESETS.some((p) => p.value === currentCron && p.value !== "");

                return (
                    <div className="space-y-5">
                        {/* Name & Description */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">Automation Name</label>
                            <input
                                value={automationData.name}
                                onChange={(e) => setAutomationData({ ...automationData, name: e.target.value })}
                                className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm"
                                placeholder="e.g., Security Audit (Deep Dive)"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">Description</label>
                            <textarea
                                value={automationData.description}
                                onChange={(e) => setAutomationData({ ...automationData, description: e.target.value })}
                                className="w-full h-20 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm resize-none"
                                placeholder="Describe the purpose of this automation..."
                            />
                        </div>

                        {/* Trigger Type */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">Trigger</label>
                            <div className="grid grid-cols-2 gap-2">
                                {TRIGGER_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => {
                                            const updates: Partial<AutomationDefinition> = { triggerType: opt.id };
                                            if (opt.id === "schedule" && !automationData.schedule) {
                                                updates.schedule = { enabled: true, cron: "0 9 * * *", timezone: "UTC" };
                                            }
                                            if (opt.id === "git_event" && !automationData.gitEventConfig) {
                                                updates.gitEventConfig = { events: ["push"], branches: [], secret: "" };
                                            }
                                            setAutomationData({ ...automationData, ...updates });
                                        }}
                                        className={`flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors ${
                                            currentTrigger === opt.id
                                                ? "border-text-primary bg-state-selected"
                                                : "border-border-subtle hover:border-border-strong hover:bg-state-hover"
                                        }`}
                                    >
                                        <span className="text-xs font-medium text-text-primary">{opt.label}</span>
                                        <span className="text-[10px] text-text-muted">{opt.description}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Schedule sub-form */}
                        {currentTrigger === "schedule" && (
                            <div className="space-y-3 rounded-md border border-border-subtle bg-bg-elevated/30 p-3">
                                <div className="text-xs font-semibold text-text-primary uppercase tracking-wider">Schedule Configuration</div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted uppercase">Frequency</label>
                                    <div className="flex flex-wrap gap-1">
                                        {CRON_PRESETS.map((preset) => (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => {
                                                    setAutomationData({
                                                        ...automationData,
                                                        schedule: {
                                                            ...automationData.schedule!,
                                                            enabled: true,
                                                            cron: preset.value || automationData.schedule?.cron || "",
                                                        },
                                                    });
                                                }}
                                                className={`rounded-md px-2 py-1 text-[10px] font-medium border transition-colors ${
                                                    (preset.value !== "" && currentCron === preset.value) || (preset.value === "" && !isPresetCron && currentCron !== "")
                                                        ? "border-text-primary bg-state-selected text-text-primary"
                                                        : "border-border-subtle text-text-muted hover:border-border-strong"
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                    {(!isPresetCron || currentCron === "") && (
                                        <input
                                            value={currentCron}
                                            onChange={(e) =>
                                                setAutomationData({
                                                    ...automationData,
                                                    schedule: { ...automationData.schedule!, enabled: true, cron: e.target.value },
                                                })
                                            }
                                            placeholder="Cron expression (e.g. 0 9 * * 1-5)"
                                            className="w-full rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                                        />
                                    )}
                                    {currentCron && (
                                        <div className="text-[10px] text-text-muted">{describeCron(currentCron)}</div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-text-muted uppercase">Timezone</label>
                                        <select
                                            value={automationData.schedule?.timezone || "UTC"}
                                            onChange={(e) =>
                                                setAutomationData({
                                                    ...automationData,
                                                    schedule: { ...automationData.schedule!, timezone: e.target.value },
                                                })
                                            }
                                            className="w-full rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-xs"
                                        >
                                            {COMMON_TIMEZONES.map((tz) => (
                                                <option key={tz} value={tz}>{tz}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-text-muted uppercase">Max Runs (optional)</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={automationData.schedule?.maxRuns || ""}
                                            onChange={(e) =>
                                                setAutomationData({
                                                    ...automationData,
                                                    schedule: {
                                                        ...automationData.schedule!,
                                                        maxRuns: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                                    },
                                                })
                                            }
                                            placeholder="Unlimited"
                                            className="w-full rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Webhook sub-form */}
                        {currentTrigger === "webhook" && (
                            <div className="space-y-3 rounded-md border border-border-subtle bg-bg-elevated/30 p-3">
                                <div className="text-xs font-semibold text-text-primary uppercase tracking-wider">Webhook Configuration</div>
                                <div className="text-[10px] text-text-muted">
                                    A signing secret will be auto-generated when the automation is created. You will be able to view the webhook URL and secret on the automation detail page.
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-text-muted uppercase">Allowed IPs (optional, comma-separated)</label>
                                    <input
                                        value={automationData.webhookConfig?.allowedIps?.join(", ") || ""}
                                        onChange={(e) => {
                                            const ips = e.target.value.split(",").map((ip) => ip.trim()).filter(Boolean);
                                            setAutomationData({
                                                ...automationData,
                                                webhookConfig: {
                                                    ...automationData.webhookConfig,
                                                    secret: automationData.webhookConfig?.secret || "",
                                                    allowedIps: ips.length > 0 ? ips : undefined,
                                                },
                                            });
                                        }}
                                        placeholder="Leave empty to allow any IP"
                                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Git Event sub-form */}
                        {currentTrigger === "git_event" && (
                            <div className="space-y-3 rounded-md border border-border-subtle bg-bg-elevated/30 p-3">
                                <div className="text-xs font-semibold text-text-primary uppercase tracking-wider">Git Event Configuration</div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted uppercase">Event Types</label>
                                    <div className="flex gap-2">
                                        {GIT_EVENT_OPTIONS.map((evt) => {
                                            const selected = automationData.gitEventConfig?.events?.includes(evt.id) ?? false;
                                            return (
                                                <button
                                                    key={evt.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const current = automationData.gitEventConfig?.events || [];
                                                        const next = selected
                                                            ? current.filter((e) => e !== evt.id)
                                                            : [...current, evt.id];
                                                        setAutomationData({
                                                            ...automationData,
                                                            gitEventConfig: {
                                                                ...automationData.gitEventConfig!,
                                                                events: next as GitEventType[],
                                                            },
                                                        });
                                                    }}
                                                    className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${
                                                        selected
                                                            ? "border-text-primary bg-state-selected text-text-primary"
                                                            : "border-border-subtle text-text-muted hover:border-border-strong"
                                                    }`}
                                                >
                                                    {evt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-text-muted uppercase">Branch Filter (optional, comma-separated)</label>
                                    <input
                                        value={automationData.gitEventConfig?.branches?.join(", ") || ""}
                                        onChange={(e) => {
                                            const branches = e.target.value.split(",").map((b) => b.trim()).filter(Boolean);
                                            setAutomationData({
                                                ...automationData,
                                                gitEventConfig: {
                                                    ...automationData.gitEventConfig!,
                                                    branches: branches.length > 0 ? branches : undefined,
                                                },
                                            });
                                        }}
                                        placeholder="e.g. main, release/* (empty = all branches)"
                                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                                    />
                                </div>
                                <div className="text-[10px] text-text-muted">
                                    A signing secret will be auto-generated. Configure the webhook URL in your git provider after creation.
                                </div>
                            </div>
                        )}
                    </div>
                );
            }
            case 4: {
                const triggerLabel = TRIGGER_OPTIONS.find((t) => t.id === (automationData.triggerType || "manual"))?.label || "Manual";
                return (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-text-primary">Automation Summary</h4>
                            <div className="rounded-md border border-border-subtle bg-bg-surface p-4">
                                <div className="grid grid-cols-2 gap-y-3 text-sm">
                                    <span className="text-text-muted">Name:</span>
                                    <span className="text-text-primary font-medium">{automationData.name}</span>
                                    <span className="text-text-muted">Stages:</span>
                                    <span className="text-text-primary">{automationData.stages?.length} stages</span>
                                    <span className="text-text-muted">Providers:</span>
                                    <span className="text-text-primary">
                                        {[...new Set(automationData.stages?.map(s => s.llmProvider))]
                                            .map(p => PROVIDER_LABELS[p] ?? p)
                                            .join(", ")}
                                    </span>
                                    <span className="text-text-muted">Trigger:</span>
                                    <span className="text-text-primary">{triggerLabel}</span>
                                    {automationData.triggerType === "schedule" && automationData.schedule?.cron && (
                                        <>
                                            <span className="text-text-muted">Schedule:</span>
                                            <span className="text-text-primary">{describeCron(automationData.schedule.cron)} ({automationData.schedule.timezone || "UTC"})</span>
                                        </>
                                    )}
                                    {automationData.triggerType === "git_event" && automationData.gitEventConfig && (
                                        <>
                                            <span className="text-text-muted">Git Events:</span>
                                            <span className="text-text-primary">{automationData.gitEventConfig.events?.join(", ")}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-text-primary">Stage Preview</h4>
                            <div className="space-y-1">
                                {automationData.stages?.map((s: AutomationStageConfig, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 hover:bg-state-hover rounded">
                                        <span className="w-4 h-4 flex items-center justify-center rounded-full bg-bg-elevated text-[10px] text-text-muted border border-border-subtle">
                                            {i + 1}
                                        </span>
                                        <span className="font-medium text-text-primary">{s.name}</span>
                                        <span className="px-1 rounded bg-bg-elevated text-[10px] text-text-muted border border-border-subtle">
                                            {graphOptions.find(g => g.id === s.graphId)?.name || s.graphId}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="rounded border border-status-error-border bg-status-error-bg p-3 text-xs text-status-error-text">
                                {error}
                            </div>
                        )}
                    </div>
                );
            }
            default:
                return null;
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Step ${step} of 4`}
            subtitle={
                step === 1 ? "Choose Template" :
                    step === 2 ? "Configure Stages" :
                        step === 3 ? "Settings & Trigger" :
                            "Review & Create"
            }
            footer={
                <div className="flex items-center justify-between">
                    <Button
                        variant="secondary"
                        onClick={() => step > 1 ? setStep((step - 1) as WizardStep) : onClose()}
                    >
                        {step === 1 ? "Cancel" : "Back"}
                    </Button>
                    <div className="flex gap-3">
                        {step < 4 ? (
                            <Button
                                disabled={step === 2 && (!automationData.stages || automationData.stages.length === 0 || hasPromptIssues)}
                                onClick={() => setStep((step + 1) as WizardStep)}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                loading={loading}
                                disabled={hasPromptIssues}
                                onClick={() => void handleCreate()}
                            >
                                {editAutomationId ? "Update Automation" : "Create Automation"}
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            {renderStep()}
        </Modal>
    );
}
