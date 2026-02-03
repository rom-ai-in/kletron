"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Sparkles, Save, RotateCcw, Monitor, Cloud, Check, Globe, Bot, Cpu, Server } from "lucide-react";

import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import type { LlmConfig } from "@/src/schemas/llmConfig.schema";
import { MODEL_RECOMMENDATIONS, type LlmProviderType } from "@/src/schemas/llmConfig.schema";

// Provider metadata for display
const PROVIDERS = [
  {
    id: "azure" as const,
    name: "Azure OpenAI",
    description: "Enterprise-grade cloud inference",
    icon: Cloud,
    color: "blue",
  },
  {
    id: "openai" as const,
    name: "OpenAI",
    description: "Direct OpenAI API access",
    icon: Sparkles,
    color: "emerald",
  },
  {
    id: "claude" as const,
    name: "Claude",
    description: "Anthropic's Claude models",
    icon: Bot,
    color: "orange",
  },
  {
    id: "gemini" as const,
    name: "Google Gemini",
    description: "Google's Gemini AI models",
    icon: Globe,
    color: "purple",
  },
  {
    id: "lmstudio" as const,
    name: "LM Studio",
    description: "Local inference via localhost",
    icon: Monitor,
    color: "cyan",
  },
  {
    id: "ollama" as const,
    name: "Ollama",
    description: "Run models locally with Ollama",
    icon: Server,
    color: "pink",
  },
];

export function LlmConfigView() {
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states for each provider
  const [azureForm, setAzureForm] = useState<Record<string, string>>({});
  const [openaiForm, setOpenaiForm] = useState<Record<string, string>>({});
  const [claudeForm, setClaudeForm] = useState<Record<string, string>>({});
  const [geminiForm, setGeminiForm] = useState<Record<string, string>>({});
  const [lmstudioForm, setLmstudioForm] = useState<Record<string, string>>({});
  const [ollamaForm, setOllamaForm] = useState<Record<string, string>>({});

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/llm-config");
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();
      setConfig(data);

      // Initialize forms
      if (data.azure) setAzureForm(data.azure);
      if (data.openai) setOpenaiForm(data.openai);
      if (data.claude) setClaudeForm(data.claude);
      if (data.gemini) setGeminiForm(data.gemini);
      if (data.lmstudio) setLmstudioForm(data.lmstudio);
      if (data.ollama) setOllamaForm(data.ollama);
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

  const handleProviderChange = async (provider: LlmProviderType) => {
    setSaving(true);
    try {
      const res = await fetch("/api/llm-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (!res.ok) throw new Error("Failed to update provider");

      const updated = await res.json();
      setConfig(updated);
      showMessage("success", `Active provider switched to ${PROVIDERS.find(p => p.id === provider)?.name}`);
    } catch (error) {
      console.error(error);
      showMessage("error", "Failed to switch provider");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProvider = async (
    e: FormEvent,
    provider: LlmProviderType,
    formData: Record<string, string>
  ) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/llm-config/${provider}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save config");
      }

      const data = await res.json();
      setConfig(prev => prev ? { ...prev, [provider]: data.config[provider], updatedAt: data.config.updatedAt } : null);
      showMessage("success", `${PROVIDERS.find(p => p.id === provider)?.name} configuration saved`);
    } catch (error) {
      console.error(error);
      showMessage("error", error instanceof Error ? error.message : "Failed to save settings");
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

  const activeProvider = config?.provider;

  return (
    <div className="flex h-full flex-col bg-bg-app overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
            <Cpu className="h-5 w-5" />
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
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Select Active Provider</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROVIDERS.map((provider) => {
              const Icon = provider.icon;
              const isActive = activeProvider === provider.id;
              return (
                <div
                  key={provider.id}
                  onClick={() => void handleProviderChange(provider.id)}
                  className={`cursor-pointer group relative p-4 rounded-lg border-2 transition-all ${isActive
                      ? "border-emerald-500 bg-bg-surface"
                      : "border-border-subtle bg-bg-elevated/50 hover:border-border-strong"
                    }`}
                >
                  {isActive && (
                    <div className="absolute top-3 right-3 text-emerald-500">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2 rounded-md transition-colors ${isActive
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-bg-elevated text-text-muted group-hover:text-text-primary"
                        }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3
                        className={`font-semibold ${isActive
                            ? "text-text-primary"
                            : "text-text-secondary group-hover:text-text-primary"
                          }`}
                      >
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

        {/* Configuration Forms */}
        <div className="mt-6 space-y-6">
          {/* Azure Form */}
          {activeProvider === "azure" && (
            <ProviderForm
              title="Azure OpenAI Settings"
              icon={Cloud}
              onSubmit={(e) => void handleSaveProvider(e, "azure", azureForm)}
              saving={saving}
              fields={[
                { label: "Endpoint URL", key: "endpoint", type: "url", placeholder: "https://resource-name.openai.azure.com/" },
                { label: "API Key", key: "apiKey", type: "password", placeholder: "••••••••" },
                { label: "Deployment Name", key: "deployment", placeholder: "my-deployment" },
                { label: "Model Name", key: "model", placeholder: "gpt-4o", suggestions: MODEL_RECOMMENDATIONS.azure },
                { label: "API Version", key: "apiVersion", placeholder: "2024-12-01-preview" },
              ]}
              formData={azureForm}
              setFormData={setAzureForm}
            />
          )}

          {/* OpenAI Form */}
          {activeProvider === "openai" && (
            <ProviderForm
              title="OpenAI Settings"
              icon={Sparkles}
              onSubmit={(e) => void handleSaveProvider(e, "openai", openaiForm)}
              saving={saving}
              fields={[
                { label: "API Key", key: "apiKey", type: "password", placeholder: "sk-..." },
                { label: "Model", key: "model", placeholder: "gpt-4o", suggestions: MODEL_RECOMMENDATIONS.openai },
                { label: "Organization ID (Optional)", key: "organization", placeholder: "org-..." },
              ]}
              formData={openaiForm}
              setFormData={setOpenaiForm}
            />
          )}

          {/* Claude Form */}
          {activeProvider === "claude" && (
            <ProviderForm
              title="Claude (Anthropic) Settings"
              icon={Bot}
              onSubmit={(e) => void handleSaveProvider(e, "claude", claudeForm)}
              saving={saving}
              fields={[
                { label: "API Key", key: "apiKey", type: "password", placeholder: "sk-ant-..." },
                { label: "Model", key: "model", placeholder: "claude-sonnet-4-20250514", suggestions: MODEL_RECOMMENDATIONS.claude },
              ]}
              formData={claudeForm}
              setFormData={setClaudeForm}
            />
          )}

          {/* Gemini Form */}
          {activeProvider === "gemini" && (
            <ProviderForm
              title="Google Gemini Settings"
              icon={Globe}
              onSubmit={(e) => void handleSaveProvider(e, "gemini", geminiForm)}
              saving={saving}
              fields={[
                { label: "API Key", key: "apiKey", type: "password", placeholder: "AIza..." },
                { label: "Model", key: "model", placeholder: "gemini-2.5-flash", suggestions: MODEL_RECOMMENDATIONS.gemini },
              ]}
              formData={geminiForm}
              setFormData={setGeminiForm}
            />
          )}

          {/* LM Studio Form */}
          {activeProvider === "lmstudio" && (
            <ProviderForm
              title="LM Studio Settings"
              icon={Monitor}
              onSubmit={(e) => void handleSaveProvider(e, "lmstudio", lmstudioForm)}
              saving={saving}
              fields={[
                { label: "Base URL", key: "baseUrl", type: "url", placeholder: "http://localhost:1234/v1" },
                { label: "API Key (Optional)", key: "apiKey", type: "password", placeholder: "lm-studio" },
                { label: "Model Name", key: "model", placeholder: "local-model" },
              ]}
              formData={lmstudioForm}
              setFormData={setLmstudioForm}
              hint="Make sure your LM Studio server is running and accessible."
            />
          )}

          {/* Ollama Form */}
          {activeProvider === "ollama" && (
            <ProviderForm
              title="Ollama Settings"
              icon={Server}
              onSubmit={(e) => void handleSaveProvider(e, "ollama", ollamaForm)}
              saving={saving}
              fields={[
                { label: "Base URL", key: "baseUrl", type: "url", placeholder: "http://localhost:11434" },
                { label: "Model Name", key: "model", placeholder: "llama3.2", suggestions: MODEL_RECOMMENDATIONS.ollama },
              ]}
              formData={ollamaForm}
              setFormData={setOllamaForm}
              hint="Make sure Ollama is running. Use 'ollama list' to see available models."
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable provider form component
type FieldConfig = {
  label: string;
  key: string;
  type?: string;
  placeholder?: string;
  suggestions?: readonly string[];
};

function ProviderForm({
  title,
  icon: Icon,
  onSubmit,
  saving,
  fields,
  formData,
  setFormData,
  hint,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
  fields: FieldConfig[];
  formData: Record<string, string>;
  setFormData: (data: Record<string, string>) => void;
  hint?: string;
}) {
  return (
    <Panel className="p-0 overflow-hidden">
      <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Icon className="h-4 w-4 text-emerald-500" />
          {title}
        </h2>
      </div>
      <form onSubmit={onSubmit} className="p-5 space-y-5">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">{field.label}</label>
            <div className="relative">
              <input
                type={field.type || "text"}
                value={formData[field.key] || ""}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                list={field.suggestions ? `${field.key}-suggestions` : undefined}
              />
              {field.suggestions && (
                <datalist id={`${field.key}-suggestions`}>
                  {field.suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </div>
          </div>
        ))}
        <div className="pt-4 flex justify-end items-center">
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
          {hint && (
            <p className="flex items-center text-xs text-text-muted ml-4 flex-1">
              {hint}
            </p>
          )}
        </div>
      </form>
    </Panel>
  );
}
