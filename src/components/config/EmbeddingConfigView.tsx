"use client";

import { useEffect, useState } from "react";
import { Database, Save, RotateCcw, Monitor, Cloud, Check } from "lucide-react";

import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import type { AzureEmbeddingConfig, LMStudioEmbeddingConfig, EmbeddingConfig } from "@/src/schemas/embeddingConfig.schema";
import { AzureEmbeddingConfigForm, LMStudioEmbeddingConfigForm } from "@/src/components/EmbeddingConfigForms";

export function EmbeddingConfigView() {
    const [config, setConfig] = useState<EmbeddingConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const fetchConfig = async () => {
        try {
            const res = await fetch("/api/embedding-config");
            if (!res.ok) throw new Error("Failed to fetch config");
            const data = await res.json();
            setConfig(data);
        } catch (error) {
            console.error(error);
            setMessage({ type: "error", text: "Failed to load configuration" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchConfig();
    }, []);

    const showMessage = (type: "success" | "error", text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleProviderChange = async (provider: "azure" | "lmstudio") => {
        setSaving(true);
        try {
            const res = await fetch("/api/embedding-config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider }),
            });

            if (!res.ok) throw new Error("Failed to update provider");

            const updated = await res.json();
            setConfig(updated); // Update local state
            showMessage("success", `Active provider switched to ${provider === "azure" ? "Azure OpenAI" : "LM Studio"}`);
        } catch (error) {
            console.error(error);
            showMessage("error", "Failed to switch provider");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAzure = async (data: any) => {
        setSaving(true);
        try {
            const res = await fetch("/api/embedding-config/azure", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save Azure config");
            }

            await fetchConfig(); // Reload to get updated state (including masked keys)
            showMessage("success", "Azure configuration saved");
        } catch (error) {
            console.error(error);
            showMessage("error", error instanceof Error ? error.message : "Failed to save Azure settings");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveLmStudio = async (data: any) => {
        setSaving(true);
        try {
            const res = await fetch("/api/embedding-config/lmstudio", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save LM Studio config");
            }

            await fetchConfig(); // Reload
            showMessage("success", "LM Studio configuration saved");
        } catch (error) {
            console.error(error);
            showMessage("error", error instanceof Error ? error.message : "Failed to save LM Studio settings");
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!confirm("Are you sure you want to reset all configurations to environment defaults?")) return;

        setResetting(true);
        try {
            const res = await fetch("/api/embedding-config", { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to reset");

            await fetchConfig(); // Reload everything
            showMessage("success", "Configuration reset to defaults");
        } catch (error) {
            console.error(error);
            showMessage("error", "Failed to reset configuration");
        } finally {
            setResetting(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-text-muted">Loading configuration...</div>;
    }

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                        <Database className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Embedding Configuration</h1>
                        <p className="text-sm text-text-muted">Manage vector embedding models and connection settings</p>
                    </div>
                </div>
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-text-muted hover:text-red-400"
                        onClick={handleReset}
                        disabled={resetting || saving}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset Defaults
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-elegant">
                {message && (
                    <div
                        className={`p-3 rounded-md text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}
                    >
                        {message.text}
                    </div>
                )}

                {/* Provider Selection */}
                <Panel className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Active Provider</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Azure Option */}
                        <div
                            onClick={() => void handleProviderChange("azure")}
                            className={`cursor-pointer group relative p-4 rounded-lg border-2 transition-all ${config?.provider === "azure" ? "border-emerald-500 bg-bg-surface" : "border-border-subtle bg-bg-elevated/50 hover:border-border-strong"}`}
                        >
                            {config?.provider === "azure" && (
                                <div className="absolute top-3 right-3 text-emerald-500">
                                    <Check className="h-4 w-4" />
                                </div>
                            )}
                            <div className="flex items-start gap-4">
                                <div
                                    className={`p-2 rounded-md transition-colors ${config?.provider === "azure" ? "bg-emerald-500/10 text-emerald-500" : "bg-bg-elevated text-text-muted group-hover:text-text-primary"}`}
                                >
                                    <Cloud className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3
                                        className={`font-semibold ${config?.provider === "azure" ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"}`}
                                    >
                                        Azure OpenAI
                                    </h3>
                                    <p className="text-xs text-text-muted mt-1">Enterprise-grade embeddings (ADA-002)</p>
                                </div>
                            </div>
                        </div>

                        {/* LM Studio Option */}
                        <div
                            onClick={() => void handleProviderChange("lmstudio")}
                            className={`cursor-pointer group relative p-4 rounded-lg border-2 transition-all ${config?.provider === "lmstudio" ? "border-emerald-500 bg-bg-surface" : "border-border-subtle bg-bg-elevated/50 hover:border-border-strong"}`}
                        >
                            {config?.provider === "lmstudio" && (
                                <div className="absolute top-3 right-3 text-emerald-500">
                                    <Check className="h-4 w-4" />
                                </div>
                            )}
                            <div className="flex items-start gap-4">
                                <div
                                    className={`p-2 rounded-md transition-colors ${config?.provider === "lmstudio" ? "bg-emerald-500/10 text-emerald-500" : "bg-bg-elevated text-text-muted group-hover:text-text-primary"}`}
                                >
                                    <Monitor className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3
                                        className={`font-semibold ${config?.provider === "lmstudio" ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"}`}
                                    >
                                        LM Studio
                                    </h3>
                                    <p className="text-xs text-text-muted mt-1">Local embeddings via localhost</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Panel>

                {/* Configuration Forms - Conditionally Rendered */}
                <div className="mt-6">
                    {/* Azure Form */}
                    {config?.provider === "azure" && (
                        <Panel className="p-0 overflow-hidden">
                            <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
                                <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                    <Cloud className="h-4 w-4 text-emerald-500" />
                                    Azure Open AI Settings
                                </h2>
                            </div>
                            <div className="p-5">
                                <AzureEmbeddingConfigForm
                                    initialConfig={config.azure}
                                    onSave={handleSaveAzure}
                                    onCancel={() => { }} // No cancel needed in this view really as we are in a dedicated page, or we could just do nothing
                                />
                            </div>
                        </Panel>
                    )}

                    {/* LM Studio Form */}
                    {config?.provider === "lmstudio" && (
                        <Panel className="p-0 overflow-hidden">
                            <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
                                <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                    <Monitor className="h-4 w-4 text-emerald-500" />
                                    LM Studio Settings
                                </h2>
                            </div>
                            <div className="p-5">
                                <LMStudioEmbeddingConfigForm
                                    initialConfig={config.lmstudio}
                                    onSave={handleSaveLmStudio}
                                    onCancel={() => { }}
                                />
                            </div>
                        </Panel>
                    )}
                </div>
            </div>
        </div>
    );
}
