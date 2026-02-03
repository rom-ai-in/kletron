"use client";

import { useEffect, useState } from "react";
import { Database, Save, RotateCcw, Monitor, Cloud, Check, Sparkles, Ship, Gem, Bot } from "lucide-react";
import { Panel, Button } from "@/src/components/design-system";
import type { EmbeddingConfig } from "@/src/schemas/embeddingConfig.schema";
import { EMBEDDING_PROVIDERS, EmbeddingProviderType } from "@/src/schemas/embeddingConfig.schema";
import {
    AzureEmbeddingConfigForm,
    OpenAIEmbeddingConfigForm,
    VoyageEmbeddingConfigForm,
    GeminiEmbeddingConfigForm,
    LMStudioEmbeddingConfigForm,
    OllamaEmbeddingConfigForm
} from "@/src/components/EmbeddingConfigForms";

const PROVIDERS = [
    { id: "azure" as const, name: "Azure OpenAI", description: "Enterprise-grade embeddings", icon: Cloud, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    { id: "openai" as const, name: "OpenAI", description: "text-embedding-3-small/large", icon: Sparkles, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    { id: "voyage" as const, name: "Voyage AI", description: "State-of-the-art embeddings", icon: Ship, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    { id: "gemini" as const, name: "Google Gemini", description: "text-embedding-004", icon: Gem, color: "text-amber-500", bgColor: "bg-amber-500/10" },
    { id: "lmstudio" as const, name: "LM Studio", description: "Local embeddings via localhost", icon: Monitor, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
    { id: "ollama" as const, name: "Ollama", description: "Local open-source models", icon: Bot, color: "text-rose-500", bgColor: "bg-rose-500/10" },
];

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

    const handleProviderChange = async (provider: EmbeddingProviderType) => {
        if (config?.provider === provider) return; // Already selected
        setSaving(true);
        try {
            const res = await fetch("/api/embedding-config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider }),
            });
            if (!res.ok) throw new Error("Failed to update provider");
            const updated = await res.json();
            setConfig(updated);
            const providerInfo = PROVIDERS.find(p => p.id === provider);
            showMessage("success", `Active provider switched to ${providerInfo?.name ?? provider}`);
        } catch (error) {
            console.error(error);
            showMessage("error", "Failed to switch provider");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProvider = async (provider: EmbeddingProviderType, data: any) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/embedding-config/${provider}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || `Failed to save ${provider} config`);
            }
            await fetchConfig();
            const providerInfo = PROVIDERS.find(p => p.id === provider);
            showMessage("success", `${providerInfo?.name ?? provider} configuration saved`);
        } catch (error) {
            console.error(error);
            showMessage("error", error instanceof Error ? error.message : `Failed to save ${provider} settings`);
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
            await fetchConfig();
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

    const activeProvider = PROVIDERS.find(p => p.id === config?.provider);

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
                        <p className="text-sm text-text-muted">Configure vector embedding models for semantic search</p>
                    </div>
                </div>
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

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-elegant">
                {message && (
                    <div className={`p-3 rounded-md text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}>
                        {message.text}
                    </div>
                )}

                {/* Provider Selection */}
                <Panel className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Select Embedding Provider</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {PROVIDERS.map((provider) => {
                            const Icon = provider.icon;
                            const isActive = config?.provider === provider.id;
                            return (
                                <div
                                    key={provider.id}
                                    onClick={() => void handleProviderChange(provider.id)}
                                    className={`cursor-pointer group relative p-4 rounded-lg border-2 transition-all ${isActive ? `border-emerald-500 bg-bg-surface` : "border-border-subtle bg-bg-elevated/50 hover:border-border-strong"}`}
                                >
                                    {isActive && (
                                        <div className="absolute top-3 right-3 text-emerald-500">
                                            <Check className="h-4 w-4" />
                                        </div>
                                    )}
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 rounded-md transition-colors ${isActive ? `${provider.bgColor} ${provider.color}` : "bg-bg-elevated text-text-muted group-hover:text-text-primary"}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className={`font-semibold ${isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"}`}>
                                                {provider.name}
                                            </h3>
                                            <p className="text-xs text-text-muted mt-1">{provider.description}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Panel>

                {/* Configuration Form - Conditionally Rendered */}
                {activeProvider && (
                    <Panel className="p-0 overflow-hidden">
                        <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
                            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                <activeProvider.icon className={`h-4 w-4 ${activeProvider.color}`} />
                                {activeProvider.name} Settings
                            </h2>
                        </div>
                        <div className="p-5">
                            {config?.provider === "azure" && (
                                <AzureEmbeddingConfigForm
                                    initialConfig={config.azure}
                                    onSave={(data) => handleSaveProvider("azure", data)}
                                    onCancel={() => { }}
                                />
                            )}
                            {config?.provider === "openai" && (
                                <OpenAIEmbeddingConfigForm
                                    initialConfig={config.openai}
                                    onSave={(data) => handleSaveProvider("openai", data)}
                                    onCancel={() => { }}
                                />
                            )}
                            {config?.provider === "voyage" && (
                                <VoyageEmbeddingConfigForm
                                    initialConfig={config.voyage}
                                    onSave={(data) => handleSaveProvider("voyage", data)}
                                    onCancel={() => { }}
                                />
                            )}
                            {config?.provider === "gemini" && (
                                <GeminiEmbeddingConfigForm
                                    initialConfig={config.gemini}
                                    onSave={(data) => handleSaveProvider("gemini", data)}
                                    onCancel={() => { }}
                                />
                            )}
                            {config?.provider === "lmstudio" && (
                                <LMStudioEmbeddingConfigForm
                                    initialConfig={config.lmstudio}
                                    onSave={(data) => handleSaveProvider("lmstudio", data)}
                                    onCancel={() => { }}
                                />
                            )}
                            {config?.provider === "ollama" && (
                                <OllamaEmbeddingConfigForm
                                    initialConfig={config.ollama}
                                    onSave={(data) => handleSaveProvider("ollama", data)}
                                    onCancel={() => { }}
                                />
                            )}
                        </div>
                    </Panel>
                )}
            </div>
        </div>
    );
}
