import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";

type AzureConfigFormProps = {
    initialConfig?: {
        endpoint: string;
        deployment: string;
        model: string;
        apiVersion: string;
        apiKey?: string;
    };
    onSave: (config: {
        endpoint: string;
        deployment: string;
        model: string;
        apiVersion: string;
        apiKey: string;
    }) => Promise<void>;
    onCancel: () => void;
};

export function AzureConfigForm({ initialConfig, onSave, onCancel }: AzureConfigFormProps) {
    const [endpoint, setEndpoint] = useState(initialConfig?.endpoint ?? "");
    const [deployment, setDeployment] = useState(initialConfig?.deployment ?? "");
    const [model, setModel] = useState(initialConfig?.model ?? "");
    const [apiVersion, setApiVersion] = useState(initialConfig?.apiVersion ?? "");
    const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testMessage, setTestMessage] = useState<string>("");

    const handleTestConnection = async () => {
        setTestStatus("testing");
        setTestMessage("");
        setError(null);

        try {
            const res = await fetch("/api/llm-config/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "azure",
                    config: {
                        endpoint,
                        deployment,
                        model,
                        apiVersion,
                        apiKey,
                    },
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Connection refused");
            }

            setTestStatus("success");
            setTestMessage(`Success! Latency: ${data.latency}ms`);
        } catch (err) {
            setTestStatus("error");
            setTestMessage(err instanceof Error ? err.message : "Connection failed");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);

        try {
            await onSave({
                endpoint,
                deployment,
                model,
                apiVersion,
                apiKey: apiKey === "••••••••" ? (initialConfig?.apiKey && initialConfig.apiKey !== "••••••••" ? initialConfig.apiKey : "") : apiKey,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
                <label htmlFor="azure-endpoint" className="block text-[11px] text-text-muted mb-1">
                    Endpoint URL
                </label>
                <input
                    id="azure-endpoint"
                    type="url"
                    required
                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                    placeholder="https://your-resource.cognitiveservices.azure.com"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                />
            </div>

            <div>
                <label htmlFor="azure-deployment" className="block text-[11px] text-text-muted mb-1">
                    Deployment Name
                </label>
                <input
                    id="azure-deployment"
                    type="text"
                    required
                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                    placeholder="gpt-5-mini"
                    value={deployment}
                    onChange={(e) => setDeployment(e.target.value)}
                />
            </div>

            <div>
                <label htmlFor="azure-model" className="block text-[11px] text-text-muted mb-1">
                    Model Name
                </label>
                <input
                    id="azure-model"
                    type="text"
                    required
                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                    placeholder="gpt-5-mini"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                />
            </div>

            <div>
                <label htmlFor="azure-api-version" className="block text-[11px] text-text-muted mb-1">
                    API Version
                </label>
                <input
                    id="azure-api-version"
                    type="text"
                    required
                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                    placeholder="2024-12-01-preview"
                    value={apiVersion}
                    onChange={(e) => setApiVersion(e.target.value)}
                />
            </div>

            <div>
                <label htmlFor="azure-api-key" className="block text-[11px] text-text-muted mb-1">
                    API Key
                </label>
                <div className="relative">
                    <input
                        id="azure-api-key"
                        type={showApiKey ? "text" : "password"}
                        required={!initialConfig?.apiKey}
                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong pr-10"
                        placeholder="Enter API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {error && (
                <p className="text-xs text-status-error-text mt-2">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-state-hover disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => void handleTestConnection()}
                    disabled={isSaving || testStatus === "testing"}
                    className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-state-hover disabled:opacity-50"
                >
                    {testStatus === "testing" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                    ) : testStatus === "success" ? (
                        <Check className="h-4 w-4 text-status-success-text" />
                    ) : testStatus === "error" ? (
                        <AlertCircle className="h-4 w-4 text-status-error-text" />
                    ) : null}
                    {testStatus === "testing" ? "Testing..." : "Test Connection"}
                </button>
                {testMessage && testStatus !== "idle" && (
                    <span className={`text-xs my-auto ${testStatus === "success" ? "text-status-success-text" : "text-status-error-text"}`}>
                        {testMessage}
                    </span>
                )}
                <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-md border border-border-strong bg-bg-elevated px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-state-hover disabled:opacity-50"
                >
                    {isSaving ? "Saving..." : "Save"}
                </button>
            </div>
        </form>
    );
}

type LMStudioConfigFormProps = {
    initialConfig?: {
        baseUrl: string;
        model: string;
        apiKey?: string;
        modelSettings?: Record<string, LMStudioModelSettings>;
    };
    onSave: (config: {
        baseUrl: string;
        model: string;
        apiKey?: string;
        modelSettings?: Record<string, LMStudioModelSettings>;
    }) => Promise<void>;
    onCancel: () => void;
};

type LMStudioModelSettings = {
    contextWindow?: number;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    repeatPenalty?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
};

type LMStudioModelInfo = {
    id: string;
    loaded?: boolean;
    instanceId?: string;
    maxContextLength?: number;
};

export function LMStudioConfigForm({ initialConfig, onSave, onCancel }: LMStudioConfigFormProps) {
    const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "http://127.0.0.1:1234/v1");
    const [model, setModel] = useState(initialConfig?.model ?? "");
    const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");
    const [modelSettings, setModelSettings] = useState<Record<string, LMStudioModelSettings>>(
        initialConfig?.modelSettings ?? {}
    );
    const [baseline, setBaseline] = useState<string>("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testMessage, setTestMessage] = useState<string>("");
    const [availableModels, setAvailableModels] = useState<LMStudioModelInfo[]>([]);
    const [loadedModel, setLoadedModel] = useState<string | null>(null);
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelsError, setModelsError] = useState<string | null>(null);
    const [modelsErrorDetails, setModelsErrorDetails] = useState<string | null>(null);
    const [reloadingModel, setReloadingModel] = useState(false);
    const activeModelSettings = model ? modelSettings[model] : undefined;

    const normalizedConfig = useMemo(() => {
        const normalizedApiKey =
            apiKey && apiKey.includes("•") ? "__masked__" : apiKey || "";
        return JSON.stringify({
            baseUrl: baseUrl || "",
            model: model || "",
            apiKey: normalizedApiKey,
            modelSettings: modelSettings ?? {},
        });
    }, [apiKey, baseUrl, model, modelSettings]);

    const isDirty = baseline ? normalizedConfig !== baseline : false;

    useEffect(() => {
        const initialApiKey =
            initialConfig?.apiKey && initialConfig.apiKey.includes("•")
                ? "__masked__"
                : initialConfig?.apiKey || "";
        setBaseline(
            JSON.stringify({
                baseUrl: initialConfig?.baseUrl ?? "",
                model: initialConfig?.model ?? "",
                apiKey: initialApiKey,
                modelSettings: initialConfig?.modelSettings ?? {},
            })
        );
    }, [initialConfig]);

    const activeModelInfo = model
        ? availableModels.find((entry) => entry.id === model)
        : undefined;
    const isModelLoaded = !!(activeModelInfo?.loaded || (loadedModel && loadedModel === model));
    const modelInstanceId = activeModelInfo?.instanceId;

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

    const updateModelSetting = (key: keyof LMStudioModelSettings, value: number | undefined) => {
        if (!model) return;
        setModelSettings((prev) => {
            const current = prev[model] ?? {};
            const next = { ...current };
            if (value === undefined || Number.isNaN(value)) {
                delete next[key];
            } else {
                next[key] = value;
            }
            const nextSettings = { ...prev };
            if (Object.keys(next).length === 0) {
                delete nextSettings[model];
            } else {
                nextSettings[model] = next;
            }
            return nextSettings;
        });
    };

    const handleNumberChange =
        (key: keyof LMStudioModelSettings) => (event: ChangeEvent<HTMLInputElement>) => {
            const raw = event.currentTarget.value;
            const parsed = event.currentTarget.valueAsNumber;
            updateModelSetting(key, raw === "" || Number.isNaN(parsed) ? undefined : parsed);
        };

    const clearModelSettings = () => {
        if (!model) return;
        setModelSettings((prev) => {
            if (!prev[model]) return prev;
            const next = { ...prev };
            delete next[model];
            return next;
        });
    };

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
        } catch (err) {
            setModelError(err instanceof Error ? err.message : "Failed to fetch models");
            setAvailableModels([]);
            setLoadedModel(null);
        } finally {
            setLoadingModels(false);
        }
    };

    useEffect(() => {
        void fetchModels();
    }, [baseUrl]);

    const saveConfig = async () => {
        setError(null);
        setIsSaving(true);
        try {
            await onSave({
                baseUrl,
                model,
                apiKey: (apiKey === "••••••••" ? "" : apiKey) || undefined,
                modelSettings: Object.keys(modelSettings).length ? modelSettings : undefined,
            });
            setBaseline(normalizedConfig);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save configuration");
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTestStatus("testing");
        setTestMessage("");
        setError(null);

        try {
            const res = await fetch("/api/llm-config/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "lmstudio",
                    config: {
                        baseUrl,
                        model,
                        apiKey: apiKey || undefined,
                        modelSettings,
                    },
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Connection refused");
            }

            setTestStatus("success");
            setTestMessage(`Success! Latency: ${data.latency}ms`);
        } catch (err) {
            setTestStatus("error");
            setTestMessage(err instanceof Error ? err.message : "Connection failed");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveConfig();
    };

    const handleReloadLoadedModel = async () => {
        if (!modelInstanceId) {
            setModelError("Cannot reload: missing instance ID. Refresh model status first.");
            return;
        }
        setModelError(null);
        setReloadingModel(true);
        try {
            if (isDirty) {
                const saved = await saveConfig();
                if (!saved) {
                    setReloadingModel(false);
                    return;
                }
            }
            const unloadRes = await fetch("/api/llm-config/lmstudio/unload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instanceId: modelInstanceId }),
            });
            const unloadData = await unloadRes.json().catch(() => ({}));
            if (unloadData?.success === false) {
                setModelError(unloadData.error || "Failed to unload model", unloadData.details);
                setReloadingModel(false);
                return;
            }

            const loadRes = await fetch("/api/llm-config/lmstudio/load", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model }),
            });
            const loadData = await loadRes.json().catch(() => ({}));
            if (loadData?.success === false) {
                setModelError(loadData.error || "Failed to load model", loadData.details);
                setReloadingModel(false);
                return;
            }
            await fetchModels();
        } catch (err) {
            setModelError(err instanceof Error ? err.message : "Failed to reload model");
        } finally {
            setReloadingModel(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
                <label htmlFor="lmstudio-base-url" className="block text-[11px] text-text-muted mb-1">
                    Base URL
                </label>
                <input
                    id="lmstudio-base-url"
                    type="url"
                    required
                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                    placeholder="http://127.0.0.1:1234/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                />
            </div>

            <div>
                <label htmlFor="lmstudio-model" className="block text-[11px] text-text-muted mb-1">
                    Model Name
                </label>
                <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] text-text-muted">
                        {loadingModels ? "Checking loaded model..." : "Loaded status"}
                    </span>
                    <button
                        type="button"
                        onClick={() => void fetchModels()}
                        disabled={loadingModels}
                        className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
                    >
                        Refresh
                    </button>
                </div>
                <input
                    id="lmstudio-model"
                    type="text"
                    required
                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                    placeholder="your-local-model-name"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                />
                {modelsError && (
                    <div className="mt-1 space-y-1">
                        <p className="text-[11px] text-status-warning-text">{modelsError}</p>
                        {modelsErrorDetails && (
                            <p className="text-[11px] text-text-muted">Details: {modelsErrorDetails}</p>
                        )}
                    </div>
                )}
                {isModelLoaded && (
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-status-success-text">
                        <span>Loaded in LM Studio</span>
                        {activeModelInfo?.maxContextLength && (
                            <span className="text-text-muted">
                                ctx {activeModelInfo.maxContextLength.toLocaleString()}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="rounded-md border border-border-subtle bg-bg-elevated/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-text-secondary">Model Settings</p>
                    <div className="flex items-center gap-2">
                        {model && activeModelSettings && Object.keys(activeModelSettings).length > 0 && (
                            <button
                                type="button"
                                onClick={clearModelSettings}
                                className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
                            >
                                Clear
                            </button>
                        )}
                        {model && isModelLoaded && (
                            <button
                                type="button"
                                onClick={() => void handleReloadLoadedModel()}
                                disabled={reloadingModel || isSaving}
                                className="rounded border border-border-subtle px-2 py-1 text-[11px] text-text-muted hover:text-text-primary hover:border-border-strong transition-colors disabled:opacity-50"
                            >
                                {reloadingModel ? "Reloading..." : isDirty ? "Save & Reload" : "Reload Loaded Model"}
                            </button>
                        )}
                    </div>
                </div>
                {!model ? (
                    <p className="text-[11px] text-text-muted">Enter a model name to configure per-model settings.</p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] text-text-muted mb-1">Context Window (tokens)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={activeModelSettings?.contextWindow ?? ""}
                                    onChange={handleNumberChange("contextWindow")}
                                    placeholder="8192"
                                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-text-muted mb-1">Max Output Tokens</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={activeModelSettings?.maxTokens ?? ""}
                                    onChange={handleNumberChange("maxTokens")}
                                    placeholder="2048"
                                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-text-muted mb-1">Temperature</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={5}
                                    step={0.1}
                                    value={activeModelSettings?.temperature ?? ""}
                                    onChange={handleNumberChange("temperature")}
                                    placeholder="0.7"
                                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-text-muted mb-1">Top P</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    value={activeModelSettings?.topP ?? ""}
                                    onChange={handleNumberChange("topP")}
                                    placeholder="0.95"
                                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-text-muted mb-1">Top K</label>
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={activeModelSettings?.topK ?? ""}
                                    onChange={handleNumberChange("topK")}
                                    placeholder="50"
                                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-text-muted mb-1">Repeat Penalty</label>
                                <input
                                    type="number"
                                    min={0}
                                    step={0.05}
                                    value={activeModelSettings?.repeatPenalty ?? ""}
                                    onChange={handleNumberChange("repeatPenalty")}
                                    placeholder="1.05"
                                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-text-muted mb-1">Presence Penalty</label>
                                <input
                                    type="number"
                                    min={-2}
                                    max={2}
                                    step={0.1}
                                    value={activeModelSettings?.presencePenalty ?? ""}
                                    onChange={handleNumberChange("presencePenalty")}
                                    placeholder="0"
                                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-text-muted mb-1">Frequency Penalty</label>
                                <input
                                    type="number"
                                    min={-2}
                                    max={2}
                                    step={0.1}
                                    value={activeModelSettings?.frequencyPenalty ?? ""}
                                    onChange={handleNumberChange("frequencyPenalty")}
                                    placeholder="0"
                                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                                />
                            </div>
                        </div>

                        {activeModelSettings?.contextWindow &&
                            activeModelSettings?.maxTokens &&
                            activeModelSettings.maxTokens >= activeModelSettings.contextWindow && (
                                <div className="flex items-center gap-2 text-[11px] text-status-warning-text mt-1">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>Max output tokens should be less than the context window.</span>
                                </div>
                            )}
                    </>
                )}
            </div>

            <div>
                <label htmlFor="lmstudio-api-key" className="block text-[11px] text-text-muted mb-1">
                    API Key <span className="text-text-muted">(optional)</span>
                </label>
                <div className="relative">
                    <input
                        id="lmstudio-api-key"
                        type={showApiKey ? "text" : "password"}
                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong pr-10"
                        placeholder="lm-studio"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {error && (
                <p className="text-xs text-status-error-text mt-2">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-state-hover disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => void handleTestConnection()}
                    disabled={isSaving || testStatus === "testing"}
                    className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-state-hover disabled:opacity-50"
                >
                    {testStatus === "testing" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                    ) : testStatus === "success" ? (
                        <Check className="h-4 w-4 text-status-success-text" />
                    ) : testStatus === "error" ? (
                        <AlertCircle className="h-4 w-4 text-status-error-text" />
                    ) : null}
                    {testStatus === "testing" ? "Testing..." : "Test Connection"}
                </button>
                {testMessage && testStatus !== "idle" && (
                    <span className={`text-xs my-auto ${testStatus === "success" ? "text-status-success-text" : "text-status-error-text"}`}>
                        {testMessage}
                    </span>
                )}
                <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-md border border-border-strong bg-bg-elevated px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-state-hover disabled:opacity-50"
                >
                    {isSaving ? "Saving..." : "Save"}
                </button>
            </div>
        </form>
    );
}
