"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Sparkles, Save, RotateCcw, Monitor, Cloud, Check, Globe, Bot, Cpu, Server, Power, PowerOff, Download, Zap, Loader2, CheckCircle2, XCircle, AlertCircle, List } from "lucide-react";
import { Panel, Button } from "@numezis/ui/components/design-system";
import type { LlmConfig, LMStudioConfig, LMStudioModelConfig } from "@numezis/shared/schemas/llmConfig.schema";
import { MODEL_RECOMMENDATIONS, LLM_PROVIDERS, type LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";

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

interface LlmConfigViewProps {
  hideHeader?: boolean;
}

export function LlmConfigView({ hideHeader = false }: LlmConfigViewProps) {
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
  const [lmstudioForm, setLmstudioForm] = useState<Partial<LMStudioConfig>>({});
  const [ollamaForm, setOllamaForm] = useState<Record<string, string>>({});
  const [lmstudioBaseline, setLmstudioBaseline] = useState<Partial<LMStudioConfig> | null>(null);

  const normalizeLmstudio = (value?: Partial<LMStudioConfig> | null) =>
    JSON.stringify({
      baseUrl: value?.baseUrl ?? "",
      apiKey: value?.apiKey ?? "",
      model: value?.model ?? "",
      modelSettings: value?.modelSettings ?? {},
    });

  const isLmstudioDirty = useMemo(() => {
    if (!lmstudioBaseline) return false;
    return normalizeLmstudio(lmstudioForm) !== normalizeLmstudio(lmstudioBaseline);
  }, [lmstudioForm, lmstudioBaseline]);

  // Enabled providers state
  const [enabledProviders, setEnabledProviders] = useState<LlmProviderType[]>([...LLM_PROVIDERS]);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);

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
      if (data.lmstudio) {
        setLmstudioForm(data.lmstudio);
        setLmstudioBaseline(data.lmstudio);
      }
      if (data.ollama) setOllamaForm(data.ollama);
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Failed to load configuration" });
    } finally {
      setLoading(false);
    }
  };

  const fetchEnabledProviders = async () => {
    try {
      const res = await fetch("/api/llm-config/enable");
      if (res.ok) {
        const data = await res.json();
        setEnabledProviders(data.enabledProviders || [...LLM_PROVIDERS]);
      }
    } catch (e) {
      console.error("Failed to fetch enabled providers:", e);
    }
  };

  useEffect(() => {
    void fetchConfig();
    void fetchEnabledProviders();
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

  const handleToggleProvider = async (provider: LlmProviderType, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click from triggering
    const isCurrentlyEnabled = enabledProviders.includes(provider);

    setTogglingProvider(provider);
    try {
      const res = await fetch("/api/llm-config/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, enabled: !isCurrentlyEnabled }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to toggle provider");
      }

      const data = await res.json();
      setEnabledProviders(data.enabledProviders || [...LLM_PROVIDERS]);
      showMessage("success", `${PROVIDERS.find(p => p.id === provider)?.name} ${!isCurrentlyEnabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error(error);
      showMessage("error", error instanceof Error ? error.message : "Failed to toggle provider");
    } finally {
      setTogglingProvider(null);
    }
  };

  const saveProvider = async (
    provider: LlmProviderType,
    formData: Record<string, unknown>
  ): Promise<boolean> => {
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
      if (provider === "lmstudio") {
        setLmstudioBaseline(data.config?.lmstudio ?? null);
      }
      showMessage("success", `${PROVIDERS.find(p => p.id === provider)?.name} configuration saved`);
      return true;
    } catch (error) {
      console.error(error);
      showMessage("error", error instanceof Error ? error.message : "Failed to save settings");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProvider = async (
    e: FormEvent,
    provider: LlmProviderType,
    formData: Record<string, unknown>
  ) => {
    e.preventDefault();
    await saveProvider(provider, formData);
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
      {/* Header - hidden when embedded */}
      {!hideHeader && (
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
      )}

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
              const isEnabled = enabledProviders.includes(provider.id);
              const isToggling = togglingProvider === provider.id;
              return (
                <div
                  key={provider.id}
                  onClick={() => isEnabled && void handleProviderChange(provider.id)}
                  className={`group relative p-4 rounded-lg border-2 transition-all ${!isEnabled
                    ? "opacity-50 border-border-subtle bg-bg-elevated/30 cursor-not-allowed"
                    : isActive
                      ? "cursor-pointer border-emerald-500 bg-bg-surface"
                      : "cursor-pointer border-border-subtle bg-bg-elevated/50 hover:border-border-strong"
                    }`}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute top-3 right-10 text-emerald-500">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                  {/* Enable/Disable toggle */}
                  <button
                    onClick={(e) => void handleToggleProvider(provider.id, e)}
                    disabled={isToggling || (isActive && isEnabled)}
                    className={`absolute top-3 right-3 p-1 rounded transition-colors ${isToggling
                      ? "animate-pulse"
                      : isEnabled
                        ? "text-emerald-500 hover:bg-emerald-500/10"
                        : "text-zinc-500 hover:bg-zinc-500/10"
                      } ${isActive && isEnabled ? "opacity-30 cursor-not-allowed" : ""}`}
                    title={isActive && isEnabled ? "Cannot disable active provider" : isEnabled ? "Disable provider" : "Enable provider"}
                  >
                    <Power className="h-4 w-4" />
                  </button>
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
              provider="azure"
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
              provider="openai"
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
              provider="claude"
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
              provider="gemini"
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
            <LMStudioConfigForm
              formData={lmstudioForm}
              setFormData={setLmstudioForm}
              onSubmit={(e) => void handleSaveProvider(e, "lmstudio", lmstudioForm)}
              saving={saving}
              isDirty={isLmstudioDirty}
              lastUpdatedAt={config?.updatedAt}
              onSave={() => saveProvider("lmstudio", lmstudioForm)}
            />
          )}

          {/* Ollama Form */}
          {activeProvider === "ollama" && (
            <OllamaConfigForm
              formData={ollamaForm}
              setFormData={setOllamaForm}
              onSubmit={(e) => void handleSaveProvider(e, "ollama", ollamaForm)}
              saving={saving}
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

type TestResult = {
  success: boolean;
  error?: string;
  latency?: number;
  tokensPerSecond?: number;
  outputTokens?: number;
  message?: string;
  response?: string;
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
  provider,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
  fields: FieldConfig[];
  formData: Record<string, string>;
  setFormData: (data: Record<string, string>) => void;
  hint?: string;
  provider: LlmProviderType;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/llm-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          config: formData,
        }),
      });

      const result = await res.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Failed to test connection",
      });
    } finally {
      setTesting(false);
    }
  };

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

        {/* Test Connection Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleTest()}
            disabled={testing}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        {/* Test Results */}
        {testResult && (
          <div
            className={`rounded-lg border p-4 space-y-2 ${testResult.success
              ? "bg-emerald-500/5 border-emerald-500/30"
              : "bg-red-500/5 border-red-500/30"
              }`}
          >
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${testResult.success ? "text-emerald-500" : "text-red-500"}`}>
                  {testResult.success ? "Connection Successful" : "Connection Failed"}
                </p>
                {testResult.error && (
                  <p className="text-xs text-red-400 mt-1">{testResult.error}</p>
                )}
                {testResult.latency && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted mt-1">
                    <span>Latency: {testResult.latency}ms</span>
                    {testResult.tokensPerSecond !== undefined && (
                      <span>Speed: {testResult.tokensPerSecond} tok/s</span>
                    )}
                    {testResult.outputTokens !== undefined && (
                      <span>({testResult.outputTokens} tokens generated)</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 flex justify-end items-center border-t border-border-subtle">
          {hint && (
            <p className="flex items-center text-xs text-text-muted flex-1">
              {hint}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </Panel>
  );
}

// Ollama-specific form with test connection

type OllamaTestResult = {
  success: boolean;
  connectionStatus: "connected" | "failed";
  error?: string;
  details: {
    baseUrl: string;
    requestedModel: string;
    availableModels: string[];
    modelFound: boolean;
    responseTime: number;
    ollamaVersion?: string;
  };
};

function OllamaConfigForm({
  formData,
  setFormData,
  onSubmit,
  saving,
}: {
  formData: Record<string, string>;
  setFormData: (data: Record<string, string>) => void;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<OllamaTestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/llm-config/ollama/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: formData.baseUrl || "http://localhost:11434",
          model: formData.model || "",
        }),
      });

      const result = await res.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        connectionStatus: "failed",
        error: error instanceof Error ? error.message : "Failed to test connection",
        details: {
          baseUrl: formData.baseUrl || "",
          requestedModel: formData.model || "",
          availableModels: [],
          modelFound: false,
          responseTime: 0,
        },
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Panel className="p-0 overflow-hidden">
      <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Server className="h-4 w-4 text-pink-500" />
          Ollama Settings
        </h2>
      </div>
      <form onSubmit={onSubmit} className="p-5 space-y-5">
        {/* Base URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Base URL</label>
          <input
            type="url"
            value={formData.baseUrl || ""}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            placeholder="http://localhost:11434"
            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500/20 transition-all"
          />
        </div>

        {/* Model Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Model Name</label>
          <input
            type="text"
            value={formData.model || ""}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="llama3.2"
            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500/20 transition-all"
            list="ollama-model-suggestions"
          />
          <datalist id="ollama-model-suggestions">
            {MODEL_RECOMMENDATIONS.ollama.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        {/* Test Connection Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleTest()}
            disabled={testing}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        {/* Test Results */}
        {testResult && (
          <div
            className={`rounded-lg border p-4 space-y-3 ${testResult.success
              ? "bg-emerald-500/5 border-emerald-500/30"
              : "bg-red-500/5 border-red-500/30"
              }`}
          >
            {/* Status Header */}
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${testResult.success ? "text-emerald-500" : "text-red-500"}`}>
                  {testResult.success ? "Connection Successful" : "Connection Failed"}
                </p>
                {testResult.error && (
                  <p className="text-xs text-red-400 mt-1">{testResult.error}</p>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-border-subtle pt-3">
              <div>
                <span className="text-text-muted">Base URL:</span>
                <p className="font-mono text-text-secondary truncate">{testResult.details.baseUrl}</p>
              </div>
              <div>
                <span className="text-text-muted">Response Time:</span>
                <p className="font-mono text-text-secondary">{testResult.details.responseTime}ms</p>
              </div>
              {testResult.details.ollamaVersion && (
                <div>
                  <span className="text-text-muted">Ollama Version:</span>
                  <p className="font-mono text-text-secondary">{testResult.details.ollamaVersion}</p>
                </div>
              )}
              {testResult.details.requestedModel && (
                <div>
                  <span className="text-text-muted">Requested Model:</span>
                  <p className={`font-mono ${testResult.details.modelFound ? "text-emerald-500" : "text-red-400"}`}>
                    {testResult.details.requestedModel}
                    {testResult.details.modelFound ? " ✓" : " ✗"}
                  </p>
                </div>
              )}
            </div>

            {/* Available Models */}
            {testResult.details.availableModels.length > 0 && (
              <div className="border-t border-border-subtle pt-3">
                <p className="text-xs text-text-muted mb-2">Available Models ({testResult.details.availableModels.length}):</p>
                <div className="flex flex-wrap gap-1.5">
                  {testResult.details.availableModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => setFormData({ ...formData, model })}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${model === formData.model
                        ? "bg-pink-500/20 text-pink-400 border border-pink-500/40"
                        : "bg-bg-elevated text-text-secondary border border-border-subtle hover:border-pink-500/40 hover:text-pink-400"
                        }`}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No models warning */}
            {testResult.connectionStatus === "connected" && testResult.details.availableModels.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-400 border-t border-border-subtle pt-3">
                <AlertCircle className="h-4 w-4" />
                <span>No models installed. Run &apos;ollama pull llama3.2&apos; to download a model.</span>
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <div className="pt-4 flex justify-between items-center border-t border-border-subtle">
          <p className="text-xs text-text-muted">
            Make sure Ollama is running. Use &apos;ollama list&apos; to see available models.
          </p>
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </Panel>
  );
}

// LM Studio configuration form with dynamic model loading
type LMStudioTestResult = {
  success: boolean;
  error?: string;
  latency?: number;
  tokensPerSecond?: number;
  outputTokens?: number;
  details?: Record<string, unknown>;
};

type LMStudioModel = {
  id: string;
  path?: string;
  name: string;
  owned_by?: string;
  loaded?: boolean;
  instanceId?: string;
  maxContextLength?: number;
  architecture?: string;
  quantization?: string;
  size_bytes?: number;
};

function LMStudioConfigForm({
  formData,
  setFormData,
  onSubmit,
  saving,
  isDirty,
  lastUpdatedAt,
  onSave,
}: {
  formData: Partial<LMStudioConfig>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<LMStudioConfig>>>;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
  isDirty?: boolean;
  lastUpdatedAt?: string | Date;
  onSave?: () => Promise<boolean>;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LMStudioTestResult | null>(null);
  const [availableModels, setAvailableModels] = useState<(LMStudioModel & { loaded?: boolean })[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsErrorDetails, setModelsErrorDetails] = useState<string | null>(null);
  const [loadedModel, setLoadedModel] = useState<string | null>(null);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [unloadingModelId, setUnloadingModelId] = useState<string | null>(null);
  const [reloadingModelId, setReloadingModelId] = useState<string | null>(null);
  const activeModelId = (formData.model || "").trim();
  const activeModelSettings: LMStudioModelConfig | undefined =
    activeModelId && formData.modelSettings ? formData.modelSettings[activeModelId] : undefined;

  const updateModelSetting = (key: keyof LMStudioModelConfig, value: number | undefined) => {
    if (!activeModelId) return;
    setFormData((prev) => {
      const currentSettings = (prev.modelSettings?.[activeModelId] ?? {}) as LMStudioModelConfig;
      const nextSettings: LMStudioModelConfig = { ...currentSettings };
      if (value === undefined || Number.isNaN(value)) {
        delete nextSettings[key];
      } else {
        nextSettings[key] = value;
      }

      const nextModelSettings = { ...(prev.modelSettings ?? {}) } as Record<string, LMStudioModelConfig>;
      if (Object.keys(nextSettings).length === 0) {
        delete nextModelSettings[activeModelId];
      } else {
        nextModelSettings[activeModelId] = nextSettings;
      }

      return {
        ...prev,
        modelSettings: Object.keys(nextModelSettings).length ? nextModelSettings : undefined,
      };
    });
  };

  const clearModelSettings = () => {
    if (!activeModelId) return;
    setFormData((prev) => {
      if (!prev.modelSettings?.[activeModelId]) return prev;
      const nextModelSettings = { ...(prev.modelSettings ?? {}) } as Record<string, LMStudioModelConfig>;
      delete nextModelSettings[activeModelId];
      return {
        ...prev,
        modelSettings: Object.keys(nextModelSettings).length ? nextModelSettings : undefined,
      };
    });
  };

  const handleNumberChange =
    (key: keyof LMStudioModelConfig) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.currentTarget.value;
      const parsed = event.currentTarget.valueAsNumber;
      updateModelSetting(key, raw === "" || Number.isNaN(parsed) ? undefined : parsed);
    };

  const selectedModelInfo = activeModelId
    ? availableModels.find((model) => model.id === activeModelId)
    : undefined;
  const selectedModelInstanceId = selectedModelInfo?.instanceId;
  const hasModelSettings = !!(activeModelSettings && Object.keys(activeModelSettings).length > 0);
  const detectedContext = selectedModelInfo?.maxContextLength;
  const contextMax = detectedContext ?? undefined;
  const contextStep = contextMax && contextMax > 200000 ? 1024 : contextMax && contextMax > 50000 ? 512 : 128;
  const formatBytes = (value?: number) => {
    if (!value || value <= 0) return undefined;
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  };
  const lastUpdatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString()
    : null;

  const formatErrorDetails = (details: unknown) => {
    if (!details || typeof details !== "object") return null;
    const entries = Object.entries(details as Record<string, unknown>)
      .filter(([, value]) => value !== undefined && value !== null && value !== "");
    if (!entries.length) return null;
    return entries
      .map(([key, value]) => {
        if (typeof value === "string") return `${key}: ${value}`;
        return `${key}: ${JSON.stringify(value)}`;
      })
      .join(" • ");
  };

  const setModelError = (message: string | null, details?: unknown) => {
    setModelsError(message);
    setModelsErrorDetails(formatErrorDetails(details));
  };

  const handleContextWindowChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.currentTarget.value;
    const parsed = event.currentTarget.valueAsNumber;
    if (raw === "" || Number.isNaN(parsed)) {
      updateModelSetting("contextWindow", undefined);
      return;
    }
    const minValue = Math.max(1, parsed);
    const clamped = typeof contextMax === "number" ? Math.min(minValue, contextMax) : minValue;
    updateModelSetting("contextWindow", clamped);
  };

  // Fetch available models from LM Studio
  const fetchModels = async () => {
    setLoadingModels(true);
    setModelError(null);
    try {
      const res = await fetch("/api/llm-config/lmstudio/models", { cache: "no-store" });
      const data = await res.json();
      if (data.error) {
        setModelError(data.error, data.details);
        setAvailableModels([]);
        setLoadedModel(null);
      } else {
        setAvailableModels(data.models || []);
        setLoadedModel(data.loadedModel || null);
        setModelError(null);
      }
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Failed to fetch models");
      setAvailableModels([]);
      setLoadedModel(null);
    } finally {
      setLoadingModels(false);
    }
  };

  // Load a model in LM Studio
  const handleLoadModel = async (modelId: string) => {
    setLoadingModelId(modelId);
    try {
      const res = await fetch("/api/llm-config/lmstudio/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh models list to get updated loaded status
        await fetchModels();
        // Auto-select the loaded model
        setFormData((prev) => ({ ...prev, model: modelId }));
      } else {
        setModelError(data.error || "Failed to load model", data.details);
      }
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Failed to load model");
    } finally {
      setLoadingModelId(null);
    }
  };

  // Unload a model from LM Studio using instance_id
  const handleUnloadModel = async (modelId: string, instanceId?: string) => {
    if (!instanceId) {
      setModelError("Cannot unload: missing instance ID. Please refresh models.");
      return;
    }
    setUnloadingModelId(modelId);
    try {
      const res = await fetch("/api/llm-config/lmstudio/unload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh models list to get updated loaded status
        await fetchModels();
      } else {
        setModelError(data.error || "Failed to unload model", data.details);
      }
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Failed to unload model");
    } finally {
      setUnloadingModelId(null);
    }
  };

  const handleReloadModel = async (modelId: string, instanceId?: string) => {
    if (!instanceId) {
      setModelError("Cannot reload: missing instance ID. Please refresh models.");
      return;
    }
    setModelError(null);
    setReloadingModelId(modelId);
    try {
      const shouldSave = isDirty && onSave;
      if (shouldSave) {
        const saved = await onSave();
        if (!saved) {
          setReloadingModelId(null);
          return;
        }
      }
      await handleUnloadModel(modelId, instanceId);
      await handleLoadModel(modelId);
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Failed to reload model");
    } finally {
      setReloadingModelId(null);
    }
  };

  // Fetch models on mount and when baseUrl changes
  useEffect(() => {
    void fetchModels();
  }, [formData.baseUrl]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/llm-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "lmstudio",
          config: formData,
        }),
      });

      const result = await res.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Failed to test connection",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Panel className="p-0 overflow-hidden">
      <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Monitor className="h-4 w-4 text-cyan-500" />
          LM Studio Settings
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
          {isDirty ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-400">
              Unsaved changes
            </span>
          ) : (
            <span className="rounded-full border border-border-subtle bg-bg-surface px-2 py-0.5">
              All changes saved
            </span>
          )}
          {lastUpdatedLabel && (
            <span>Last updated: {lastUpdatedLabel}</span>
          )}
          <span>Settings apply per request — no reload needed.</span>
        </div>
      </div>
      <form onSubmit={onSubmit} className="p-5 space-y-5">
        {/* Base URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Base URL</label>
          <input
            type="url"
            value={formData.baseUrl || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, baseUrl: e.target.value }))}
            placeholder="http://127.0.0.1:1234/v1"
            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">API Key (Optional)</label>
          <input
            type="password"
            value={formData.apiKey || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder="lm-studio"
            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
          />
        </div>

        {/* Model Name with dropdown */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">Model Name</label>
            <button
              type="button"
              onClick={() => void fetchModels()}
              disabled={loadingModels}
              className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1 transition-colors"
            >
              {loadingModels ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Refresh Models
            </button>
          </div>
          <input
            type="text"
            value={formData.model || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="Select or type a model name"
            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
          />
          {selectedModelInfo && (
            <div className="flex flex-wrap gap-2 text-[11px] text-text-muted">
              {selectedModelInfo.architecture && (
                <span className="rounded-full border border-border-subtle bg-bg-surface px-2 py-0.5">
                  arch {selectedModelInfo.architecture}
                </span>
              )}
              {selectedModelInfo.quantization && (
                <span className="rounded-full border border-border-subtle bg-bg-surface px-2 py-0.5">
                  quant {selectedModelInfo.quantization}
                </span>
              )}
              {selectedModelInfo.size_bytes && (
                <span className="rounded-full border border-border-subtle bg-bg-surface px-2 py-0.5">
                  size {formatBytes(selectedModelInfo.size_bytes)}
                </span>
              )}
              {selectedModelInfo.maxContextLength && (
                <span className="rounded-full border border-border-subtle bg-bg-surface px-2 py-0.5">
                  ctx {selectedModelInfo.maxContextLength.toLocaleString()}
                </span>
              )}
              {selectedModelInfo.loaded && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                  loaded
                </span>
              )}
              {selectedModelInfo.loaded && (
                <span className="text-text-muted">
                  Use “Reload Loaded Model” after saving to force a reload.
                </span>
              )}
            </div>
          )}

          {/* Available Models */}
          {modelsError && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <AlertCircle className="h-3 w-3" />
                <span>{modelsError}</span>
              </div>
              {modelsErrorDetails && (
                <div className="text-[11px] text-text-muted">
                  Details: {modelsErrorDetails}
                </div>
              )}
            </div>
          )}

          {availableModels.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-text-muted">
                Available Models ({availableModels.length}):
              </p>
              <div className="space-y-1.5">
                {availableModels.map((model) => {
                  const isLoaded = model.loaded || model.id === loadedModel;
                  const isLoading = loadingModelId === model.id;
                  const isUnloading = unloadingModelId === model.id;
                  const isSelected = model.id === formData.model;
                  const isConfigured = !!formData.modelSettings?.[model.id];

                  return (
                    <div
                      key={model.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all ${isSelected
                        ? "bg-cyan-500/10 border-cyan-500/40"
                        : "bg-bg-elevated/50 border-border-subtle hover:border-border-default"
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Status indicator */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLoaded ? "bg-emerald-500" : "bg-zinc-500"
                          }`} />

                        {/* Model name - clickable to select */}
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, model: model.id }))}
                          className={`text-xs font-mono truncate text-left ${isSelected ? "text-cyan-400" : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                          {model.name}
                        </button>

                        {/* Loaded badge */}
                        {isLoaded && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex-shrink-0">
                            LOADED
                          </span>
                        )}
                        {isConfigured && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 flex-shrink-0">
                            CONFIG
                          </span>
                        )}
                        {model.maxContextLength && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted flex-shrink-0">
                            ctx {model.maxContextLength.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Load/Unload buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isLoaded ? (
                          <button
                            type="button"
                            onClick={() => void handleUnloadModel(model.id, model.instanceId)}
                            disabled={isUnloading}
                            className="text-xs px-2 py-1 rounded flex items-center gap-1 bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30 hover:text-zinc-300 transition-colors disabled:opacity-50"
                          >
                            {isUnloading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <PowerOff className="h-3 w-3" />
                            )}
                            <span>{isUnloading ? "Unloading..." : "Unload"}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleLoadModel(model.id)}
                            disabled={isLoading}
                            className="text-xs px-2 py-1 rounded flex items-center gap-1 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 hover:text-cyan-300 transition-colors disabled:opacity-50"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                            <span>{isLoading ? "Loading..." : "Load"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {availableModels.length === 0 && !modelsError && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <AlertCircle className="h-3 w-3" />
                  <span>
                    {loadingModels
                      ? "Listing models from LM Studio..."
                      : "No models listed yet. Click “List Models” to sync with LM Studio."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchModels()}
                  disabled={loadingModels}
                  className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {loadingModels ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <List className="h-3 w-3" />
                  )}
                  <span>{loadingModels ? "Listing..." : "List Models"}</span>
                </button>
              </div>

              {/* Manual load section */}
              <div className="p-3 rounded-lg border border-border-subtle bg-bg-elevated/30">
                <p className="text-[11px] text-text-muted mb-2">
                  Enter the model path from LM Studio (e.g., mistralai/devstral-small-2-2512):
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.model || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                    placeholder="organization/model-name"
                    className="flex-1 rounded-md border border-border-subtle bg-bg-app px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => void handleLoadModel(formData.model || "")}
                    disabled={!formData.model || loadingModelId !== null}
                    className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 hover:text-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingModelId ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>Load Model</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Per-Model Settings */}
        <div className="rounded-lg border border-border-subtle bg-bg-elevated/30 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-text-secondary">Model Settings</h3>
              <p className="text-[11px] text-text-muted">
                Applied when this model is selected (default or per-request).
              </p>
            </div>
            {activeModelId && (
              <div className="flex items-center gap-2 text-[11px] text-text-muted">
                <span className="font-mono">{activeModelId}</span>
                {hasModelSettings && (
                  <button
                    type="button"
                    onClick={clearModelSettings}
                    className="px-2 py-1 rounded border border-border-subtle hover:border-border-strong hover:text-text-primary transition-colors"
                  >
                    Clear
                  </button>
                )}
                {selectedModelInfo?.loaded && (
                  <button
                    type="button"
                    onClick={() => void handleReloadModel(activeModelId, selectedModelInstanceId)}
                    disabled={saving || reloadingModelId === activeModelId}
                    className="px-2 py-1 rounded border border-cyan-500/40 text-cyan-400 hover:border-cyan-500 hover:text-cyan-300 transition-colors disabled:opacity-50"
                  >
                    {reloadingModelId === activeModelId
                      ? "Reloading..."
                      : isDirty
                        ? "Save & Reload"
                        : "Reload Loaded Model"}
                  </button>
                )}
              </div>
            )}
          </div>

          {!activeModelId ? (
            <p className="text-xs text-text-muted">Select a model to configure context and sampling parameters.</p>
          ) : (
            <>
              {detectedContext && !activeModelSettings?.contextWindow && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                  <span>Detected context window: {detectedContext.toLocaleString()} tokens.</span>
                  <button
                    type="button"
                    onClick={() => updateModelSetting("contextWindow", detectedContext)}
                    className="px-2 py-1 rounded border border-cyan-500/40 text-cyan-400 hover:border-cyan-500 hover:text-cyan-300 transition-colors"
                  >
                    Use detected
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Context Window (tokens)</label>
                  {contextMax ? (
                    <div className="space-y-2">
                      <input
                        type="range"
                        min={1}
                        max={contextMax}
                        step={contextStep}
                        value={activeModelSettings?.contextWindow ?? contextMax}
                        onChange={handleContextWindowChange}
                        className="w-full accent-cyan-500"
                      />
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={contextMax}
                          value={activeModelSettings?.contextWindow ?? ""}
                          onChange={handleContextWindowChange}
                          placeholder={contextMax.toString()}
                          className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
                        />
                        <span className="text-[10px] text-text-muted whitespace-nowrap">
                          max {contextMax.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      value={activeModelSettings?.contextWindow ?? ""}
                      onChange={handleContextWindowChange}
                      placeholder="8192"
                      className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Max Output Tokens</label>
                  <input
                    type="number"
                    min={1}
                    value={activeModelSettings?.maxTokens ?? ""}
                    onChange={handleNumberChange("maxTokens")}
                    placeholder="2048"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Temperature</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={activeModelSettings?.temperature ?? ""}
                    onChange={handleNumberChange("temperature")}
                    placeholder="0.7"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Top P</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={activeModelSettings?.topP ?? ""}
                    onChange={handleNumberChange("topP")}
                    placeholder="0.95"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Top K</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={activeModelSettings?.topK ?? ""}
                    onChange={handleNumberChange("topK")}
                    placeholder="50"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Repeat Penalty</label>
                  <input
                    type="number"
                    min={0}
                    step={0.05}
                    value={activeModelSettings?.repeatPenalty ?? ""}
                    onChange={handleNumberChange("repeatPenalty")}
                    placeholder="1.05"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Presence Penalty</label>
                  <input
                    type="number"
                    min={-2}
                    max={2}
                    step={0.1}
                    value={activeModelSettings?.presencePenalty ?? ""}
                    onChange={handleNumberChange("presencePenalty")}
                    placeholder="0"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Frequency Penalty</label>
                  <input
                    type="number"
                    min={-2}
                    max={2}
                    step={0.1}
                    value={activeModelSettings?.frequencyPenalty ?? ""}
                    onChange={handleNumberChange("frequencyPenalty")}
                    placeholder="0"
                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  />
                </div>
              </div>

              {activeModelSettings?.contextWindow &&
                activeModelSettings?.maxTokens &&
                activeModelSettings.maxTokens >= activeModelSettings.contextWindow && (
                  <div className="flex items-center gap-2 text-xs text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>
                      Max output tokens should be less than the context window to leave room for prompts.
                    </span>
                  </div>
                )}
            </>
          )}
        </div>

        {/* Test Connection Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleTest()}
            disabled={testing}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        {/* Test Results */}
        {testResult && (
          <div
            className={`rounded-lg border p-4 ${testResult.success
              ? "bg-emerald-500/5 border-emerald-500/30"
              : "bg-red-500/5 border-red-500/30"
              }`}
          >
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${testResult.success ? "text-emerald-500" : "text-red-500"}`}>
                  {testResult.success ? "Connection Successful" : "Connection Failed"}
                </p>
                {testResult.error && (
                  <p className="text-xs text-red-400 mt-1">{testResult.error}</p>
                )}
                {!testResult.success &&
                  testResult.details &&
                  formatErrorDetails(testResult.details) && (
                    <p className="text-[11px] text-text-muted mt-1">
                      Details: {formatErrorDetails(testResult.details)}
                    </p>
                  )}
                {testResult.success && (
                  <div className="text-xs text-text-secondary mt-1 space-y-0.5">
                    {testResult.latency && <p>Latency: {testResult.latency}ms</p>}
                    {testResult.tokensPerSecond && (
                      <p>Speed: {testResult.tokensPerSecond} tok/s</p>
                    )}
                    {testResult.outputTokens && (
                      <p>({testResult.outputTokens} tokens generated)</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-4 flex justify-between items-center border-t border-border-subtle">
          <p className="text-xs text-text-muted">
            Make sure your LM Studio server is running and accessible.
          </p>
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </Panel>
  );
}
