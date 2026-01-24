"use client";

import { useEffect, useState } from "react";
import { Sparkles, Save, RotateCcw, Monitor, Cloud, Check } from "lucide-react";

import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import type { AzureOpenAIConfig, LMStudioConfig, LlmConfig } from "@/src/schemas/llmConfig.schema";

export function LlmConfigView() {
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [azureForm, setAzureForm] = useState<Partial<AzureOpenAIConfig>>({});
  const [lmstudioForm, setLmstudioForm] = useState<Partial<LMStudioConfig>>({});

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/llm-config");
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();
      setConfig(data);

      // Initialize forms
      if (data.azure) setAzureForm(data.azure);
      if (data.lmstudio) setLmstudioForm(data.lmstudio);
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
      const res = await fetch("/api/llm-config", {
        method: "POST",
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

  const handleSaveAzure = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/llm-config/azure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(azureForm),
      });

      if (!res.ok) throw new Error("Failed to save Azure config");

      const data = await res.json();
      const updated = data.config;
      setConfig((prev) => (prev ? { ...prev, azure: updated.azure, updatedAt: updated.updatedAt } : null));
      showMessage("success", "Azure configuration saved");
    } catch (error) {
      console.error(error);
      showMessage("error", "Failed to save Azure settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLmStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/llm-config/lmstudio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lmstudioForm),
      });

      if (!res.ok) throw new Error("Failed to save LM Studio config");

      const data = await res.json();
      const updated = data.config;
      setConfig((prev) => (prev ? { ...prev, lmstudio: updated.lmstudio, updatedAt: updated.updatedAt } : null));
      showMessage("success", "LM Studio configuration saved");
    } catch (error) {
      console.error(error);
      showMessage("error", "Failed to save LM Studio settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all configurations to environment defaults?")) return;

    setResetting(true);
    try {
      const res = await fetch("/api/llm-config", { method: "DELETE" });
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">LLM Configuration</h1>
            <p className="text-sm text-text-muted">Manage AI providers and connection settings</p>
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
                  <p className="text-xs text-text-muted mt-1">Enterprise-grade cloud inference</p>
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
                  <p className="text-xs text-text-muted mt-1">Local inference via localhost</p>
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
              <form onSubmit={handleSaveAzure} className="p-5 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Endpoint URL</label>
                  <input
                    type="url"
                    value={azureForm.endpoint || ""}
                    onChange={(e) => setAzureForm({ ...azureForm, endpoint: e.target.value })}
                    placeholder="https://resource-name.openai.azure.com/"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">API Key</label>
                  <input
                    type="password"
                    value={azureForm.apiKey || ""}
                    onChange={(e) => setAzureForm({ ...azureForm, apiKey: e.target.value })}
                    placeholder="••••••••"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">Deployment Name</label>
                    <input
                      type="text"
                      value={azureForm.deployment || ""}
                      onChange={(e) => setAzureForm({ ...azureForm, deployment: e.target.value })}
                      className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">Model Name</label>
                    <input
                      type="text"
                      value={azureForm.model || ""}
                      onChange={(e) => setAzureForm({ ...azureForm, model: e.target.value })}
                      placeholder="gpt-4"
                      className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">API Version</label>
                  <input
                    type="text"
                    value={azureForm.apiVersion || ""}
                    onChange={(e) => setAzureForm({ ...azureForm, apiVersion: e.target.value })}
                    placeholder="2023-05-15"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" variant="primary" disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                  <p className="flex items-center text-xs text-text-muted ml-4 flex-1">
                    Changes are applied immediately to new agent runs.
                  </p>
                </div>
              </form>
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
              <form onSubmit={handleSaveLmStudio} className="p-5 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Base URL</label>
                  <input
                    type="url"
                    value={lmstudioForm.baseUrl || ""}
                    onChange={(e) => setLmstudioForm({ ...lmstudioForm, baseUrl: e.target.value })}
                    placeholder="http://localhost:1234/v1"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">API Key (Optional)</label>
                  <input
                    type="password"
                    value={lmstudioForm.apiKey || ""}
                    onChange={(e) => setLmstudioForm({ ...lmstudioForm, apiKey: e.target.value })}
                    placeholder="lm-studio"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Model Name</label>
                  <input
                    type="text"
                    value={lmstudioForm.model || ""}
                    onChange={(e) => setLmstudioForm({ ...lmstudioForm, model: e.target.value })}
                    placeholder="local-model"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" variant="primary" disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                  <p className="flex items-center text-xs text-text-muted ml-4 flex-1">
                    Make sure your local server is running and accessible.
                  </p>
                </div>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

