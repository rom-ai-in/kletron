import { useState } from "react";
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
                <p className="text-xs text-rose-400 mt-2">{error}</p>
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
                        <Check className="h-4 w-4 text-emerald-500" />
                    ) : testStatus === "error" ? (
                        <AlertCircle className="h-4 w-4 text-rose-500" />
                    ) : null}
                    {testStatus === "testing" ? "Testing..." : "Test Connection"}
                </button>
                {testMessage && testStatus !== "idle" && (
                    <span className={`text-xs my-auto ${testStatus === "success" ? "text-emerald-500" : "text-rose-500"}`}>
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
    };
    onSave: (config: {
        baseUrl: string;
        model: string;
        apiKey?: string;
    }) => Promise<void>;
    onCancel: () => void;
};

export function LMStudioConfigForm({ initialConfig, onSave, onCancel }: LMStudioConfigFormProps) {
    const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "http://127.0.0.1:1234/v1");
    const [model, setModel] = useState(initialConfig?.model ?? "");
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
                    provider: "lmstudio",
                    config: {
                        baseUrl,
                        model,
                        apiKey: apiKey || undefined,
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
                baseUrl,
                model,
                apiKey: (apiKey === "••••••••" ? "" : apiKey) || undefined,
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
                <input
                    id="lmstudio-model"
                    type="text"
                    required
                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                    placeholder="your-local-model-name"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                />
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
                <p className="text-xs text-rose-400 mt-2">{error}</p>
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
                        <Check className="h-4 w-4 text-emerald-500" />
                    ) : testStatus === "error" ? (
                        <AlertCircle className="h-4 w-4 text-rose-500" />
                    ) : null}
                    {testStatus === "testing" ? "Testing..." : "Test Connection"}
                </button>
                {testMessage && testStatus !== "idle" && (
                    <span className={`text-xs my-auto ${testStatus === "success" ? "text-emerald-500" : "text-rose-500"}`}>
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
