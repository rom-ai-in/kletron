"use client";

import { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";
import { SelectableRow } from "./ui/SelectableRow";
import { ChainConfigBuilder } from "../services/chainConfigBuilder";
import type { AuditChain, AuditStageConfig, GraphId } from "../services/chainTypes";
import { graphOptions } from "../shared/graphCatalog";

interface ChainBuilderModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (chainId: string) => void;
    editChainId?: string;
}

type WizardStep = 1 | 2 | 3 | 4;

export function ChainBuilderModal({ open, onClose, onCreated, editChainId }: ChainBuilderModalProps) {
    const [step, setStep] = useState<WizardStep>(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [chainData, setChainData] = useState<Partial<AuditChain>>({
        name: "",
        description: "",
        stages: [],
    });
    const [promptFiles, setPromptFiles] = useState<{ name: string; path: string }[]>([]);

    useEffect(() => {
        const fetchPrompts = async () => {
            try {
                // Fetch ALL prompts recursively from the root
                const res = await fetch("/api/prompts/files?recursive=true");
                if (res.ok) {
                    const data = await res.json();
                    setPromptFiles(data.files || []);
                }
            } catch (err) {
                console.error("Failed to fetch prompts:", err);
            }
        };

        const fetchExistingChain = async () => {
            if (!editChainId) return;
            setLoading(true);
            try {
                const res = await fetch(`/api/chains/${editChainId}`);
                if (res.ok) {
                    const data = await res.json();
                    setChainData(data.chain);
                    setStep(2); // Jump to configuration
                }
            } catch (err) {
                console.error("Failed to fetch chain:", err);
            } finally {
                setLoading(false);
            }
        };

        if (open) {
            void fetchPrompts();
            if (editChainId) {
                void fetchExistingChain();
            } else {
                // Reset for new creation
                setStep(1);
                setChainData({ name: "", description: "", stages: [] });
            }
        }
    }, [open, editChainId]);

    const presets = ChainConfigBuilder.getPresetNames();

    const handleSelectPreset = (presetName: string) => {
        const preset = ChainConfigBuilder.buildChain(presetName);
        setChainData({
            ...chainData,
            name: preset.name,
            description: preset.description,
            stages: preset.stages ? [...preset.stages] : [],
        });
        setStep(2);
    };

    const handleAddStage = () => {
        const newStage: AuditStageConfig = {
            id: `stage-${(chainData.stages?.length || 0) + 1}`,
            name: "New Audit Stage",
            graphId: "audit",
            promptPath: "A-audit/A1-api/general-api-audit.md",
            llmProvider: "azure",
        };
        setChainData({
            ...chainData,
            stages: [...(chainData.stages || []), newStage],
        });
    };

    const handleRemoveStage = (index: number) => {
        const newStages = [...(chainData.stages || [])];
        newStages.splice(index, 1);
        setChainData({ ...chainData, stages: newStages });
    };

    const handleUpdateStage = (index: number, updates: Partial<AuditStageConfig>) => {
        const newStages = [...(chainData.stages || [])];
        newStages[index] = { ...newStages[index], ...updates };
        setChainData({ ...chainData, stages: newStages });
    };

    const handleCreate = async () => {
        setLoading(true);
        setError("");
        try {
            const url = editChainId ? `/api/chains/${editChainId}` : "/api/chains";
            const method = editChainId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config: chainData }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || data.error || `Failed to ${editChainId ? "update" : "create"} campaign`);
            }
            const data = await res.json();
            onCreated(editChainId || data.chainId);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-text-secondary">
                            Start with a pre-configured template or build from scratch.
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                            {presets.map((p) => {
                                const meta = ChainConfigBuilder.getPresetMetadata(p);
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
                                label="Custom Campaign"
                                subLabel="Manually configure every audit stage and setting"
                                onClick={() => {
                                    setChainData({ name: "Custom Audit Campaign", description: "", stages: [] });
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
                        <div className="space-y-3">
                            {chainData.stages?.map((stage: AuditStageConfig, idx: number) => (
                                <Panel key={idx} className="space-y-3 p-3 text-xs border-border-subtle bg-bg-elevated/50">
                                    <div className="flex items-center justify-between gap-2">
                                        <input
                                            value={stage.name}
                                            onChange={(e) => handleUpdateStage(idx, { name: e.target.value })}
                                            className="flex-1 bg-transparent border-none p-0 font-medium text-text-primary focus:ring-0"
                                            placeholder="Stage Name"
                                        />
                                        <button
                                            onClick={() => handleRemoveStage(idx)}
                                            className="text-text-muted hover:text-rose-400"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] text-text-muted uppercase mb-1">Graph / Flow</label>
                                            <select
                                                value={stage.graphId}
                                                onChange={(e) => handleUpdateStage(idx, { graphId: e.target.value as GraphId })}
                                                className="w-full rounded border-border-subtle bg-bg-surface px-2 py-1 text-xs"
                                            >
                                                {graphOptions.map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-text-muted uppercase mb-1">LLM Provider</label>
                                            <select
                                                value={stage.llmProvider}
                                                onChange={(e) => handleUpdateStage(idx, { llmProvider: e.target.value as "azure" | "lmstudio" })}
                                                className="w-full rounded border-border-subtle bg-bg-surface px-2 py-1 text-xs"
                                            >
                                                <option value="azure">Azure OpenAI</option>
                                                <option value="lmstudio">LM Studio</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-text-muted uppercase mb-1">Prompt Selection</label>
                                        <select
                                            value={stage.promptPath}
                                            onChange={(e) => handleUpdateStage(idx, { promptPath: e.target.value })}
                                            className="w-full rounded border-border-subtle bg-bg-surface px-2 py-1 text-xs"
                                        >
                                            <option value="">Select a prompt...</option>
                                            {promptFiles.map(f => {
                                                // Format path for better readability (e.g. A-audit > A1-api > general-api-audit)
                                                const label = f.path
                                                    .replace(".md", "")
                                                    .split("/")
                                                    .join(" › ");
                                                return (
                                                    <option key={f.path} value={f.path}>{label}</option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                </Panel>
                            ))}
                            {chainData.stages?.length === 0 && (
                                <div className="py-8 text-center text-xs text-text-muted border border-dashed border-border-subtle rounded-md">
                                    No stages added. Add at least one stage to proceed.
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">Campaign Name</label>
                            <input
                                value={chainData.name}
                                onChange={(e) => setChainData({ ...chainData, name: e.target.value })}
                                className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm"
                                placeholder="e.g., Security Audit (Deep Dive)"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">Description</label>
                            <textarea
                                value={chainData.description}
                                onChange={(e) => setChainData({ ...chainData, description: e.target.value })}
                                className="w-full h-24 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm resize-none"
                                placeholder="Describe the purpose of this audit campaign..."
                            />
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-text-primary">Campaign Summary</h4>
                            <div className="rounded-md border border-border-subtle bg-bg-surface p-4">
                                <div className="grid grid-cols-2 gap-y-3 text-sm">
                                    <span className="text-text-muted">Name:</span>
                                    <span className="text-text-primary font-medium">{chainData.name}</span>
                                    <span className="text-text-muted">Stages:</span>
                                    <span className="text-text-primary">{chainData.stages?.length} stages</span>
                                    <span className="text-text-muted">Providers:</span>
                                    <span className="text-text-primary">
                                        {[...new Set(chainData.stages?.map(s => s.llmProvider))].join(", ")}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-text-primary">Stage Preview</h4>
                            <div className="space-y-1">
                                {chainData.stages?.map((s: AuditStageConfig, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 hover:bg-state-hover rounded">
                                        <span className="w-4 h-4 flex items-center justify-center rounded-full bg-bg-elevated text-[10px] text-text-muted border border-border-subtle">
                                            {i + 1}
                                        </span>
                                        <span className="font-medium text-text-primary">{s.name}</span>
                                        <span className="px-1 rounded bg-bg-elevated text-[10px] text-text-muted border border-border-subtle uppercase">
                                            {s.graphId}
                                        </span>
                                        <span className="text-[10px] text-text-muted truncate max-w-[150px]">
                                            {s.promptPath.split("/").pop()?.replace(".md", "")}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="rounded border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                                {error}
                            </div>
                        )}
                    </div>
                );
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
                        step === 3 ? "General Settings" :
                            "Review & Create"
            }
        >
            <div className="flex flex-col h-full">
                <div className="flex-1 min-h-[300px]">
                    {renderStep()}
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-border-subtle pt-6">
                    <Button
                        variant="secondary"
                        onClick={() => step > 1 ? setStep((step - 1) as WizardStep) : onClose()}
                    >
                        {step === 1 ? "Cancel" : "Back"}
                    </Button>
                    <div className="flex gap-3">
                        {step < 4 ? (
                            <Button
                                disabled={step === 2 && (!chainData.stages || chainData.stages.length === 0)}
                                onClick={() => setStep((step + 1) as WizardStep)}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                loading={loading}
                                onClick={() => void handleCreate()}
                            >
                                {editChainId ? "Update Campaign" : "Create Campaign"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
