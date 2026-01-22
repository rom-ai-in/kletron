import { useState } from "react";
import { Check, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

type AzureEmbeddingConfigFormProps = {
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

export function AzureEmbeddingConfigForm({ initialConfig, onSave, onCancel }: AzureEmbeddingConfigFormProps) {
    const [endpoint, setEndpoint] = useState(initialConfig?.endpoint ?? "");
    const [deployment, setDeployment] = useState(initialConfig?.deployment ?? "");
    const [model, setModel] = useState(initialConfig?.model ?? "text-embedding-ada-002");
    const [apiVersion, setApiVersion] = useState(initialConfig?.apiVersion ?? "2024-02-01");
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
            const res = await fetch("/api/embedding-config/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "azure",
                    config: {
                        endpoint,
                        deployment,
                        model,
                        apiVersion,
                        apiKey: apiKey === "••••••••" ? undefined : apiKey,
                    },
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Connection failed");

            setTestStatus("success");
            setTestMessage(`Success! Latency: ${data.latency}ms (${data.dimensions} dims)`);
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
                apiKey: apiKey === "••••••••" ? "" : apiKey,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-[11px] text-text-muted mb-1">Endpoint URL</label>
                    <input
                        type="url"
                        required
                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                        placeholder="https://your-resource.cognitiveservices.azure.com"
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[11px] text-text-muted mb-1">Deployment Name</label>
                    <input
                        type="text"
                        required
                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                        value={deployment}
                        onChange={(e) => setDeployment(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[11px] text-text-muted mb-1">Model Name</label>
                    <input
                        type="text"
                        required
                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[11px] text-text-muted mb-1">API Version</label>
                    <input
                        type="text"
                        required
                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                        value={apiVersion}
                        onChange={(e) => setApiVersion(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[11px] text-text-muted mb-1">API Key</label>
                    <div className="relative">
                        <input
                            type={showApiKey ? "text" : "password"}
                            required={!initialConfig?.apiKey}
                            className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong pr-10"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                        <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onCancel} disabled={isSaving} className="rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-state-hover transition disabled:opacity-50">Cancel</button>
                <button type="button" onClick={() => void handleTestConnection()} disabled={isSaving || testStatus === "testing"} className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-state-hover transition disabled:opacity-50">
                    {testStatus === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : testStatus === "success" ? <Check className="h-4 w-4 text-emerald-500" /> : testStatus === "error" ? <AlertCircle className="h-4 w-4 text-rose-500" /> : null}
                    {testStatus === "testing" ? "Testing..." : "Test Connection"}
                </button>
                {testMessage && <span className={`text-xs my-auto ${testStatus === "success" ? "text-emerald-500" : "text-rose-500"}`}>{testMessage}</span>}
                <button type="submit" disabled={isSaving} className="rounded-md border border-border-strong bg-bg-elevated px-4 py-2 text-sm font-medium text-text-primary hover:bg-state-hover transition disabled:opacity-50">{isSaving ? "Saving..." : "Save Configuration"}</button>
            </div>
        </form>
    );
}

type LMStudioEmbeddingConfigFormProps = {
    initialConfig?: {
        baseUrl: string;
        model: string;
        apiKey?: string;
        dimensions?: number;
    };
    onSave: (config: {
        baseUrl: string;
        model: string;
        apiKey?: string;
        dimensions: number;
    }) => Promise<void>;
    onCancel: () => void;
};

export function LMStudioEmbeddingConfigForm({ initialConfig, onSave, onCancel }: LMStudioEmbeddingConfigFormProps) {
    const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "http://127.0.0.1:1234/v1");
    const [model, setModel] = useState(initialConfig?.model ?? "");
    const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");
    const [dimensions, setDimensions] = useState(initialConfig?.dimensions ?? 1536);
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testMessage, setTestMessage] = useState<string>("");

    const handleTestConnection = async () => {
        setTestStatus("testing");
        setTestMessage("");
        try {
            const res = await fetch("/api/embedding-config/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "lmstudio",
                    config: { baseUrl, model, apiKey: apiKey || undefined },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Connection failed");
            setTestStatus("success");
            setTestMessage(`Success! Latency: ${data.latency}ms (${data.dimensions} dims)`);
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
                dimensions,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-[11px] text-text-muted mb-1">Base URL</label>
                    <input
                        type="url"
                        required
                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[11px] text-text-muted mb-1">Model ID</label>
                    <input
                        type="text"
                        required
                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[11px] text-text-muted mb-1">Expected Dimensions</label>
                    <input
                        type="number"
                        required
                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                        value={dimensions}
                        onChange={(e) => setDimensions(parseInt(e.target.value))}
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-[11px] text-text-muted mb-1">API Key (optional)</label>
                    <div className="relative">
                        <input
                            type={showApiKey ? "text" : "password"}
                            className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong pr-10"
                            placeholder="lm-studio"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                        <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onCancel} disabled={isSaving} className="rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-state-hover transition disabled:opacity-50">Cancel</button>
                <button type="button" onClick={() => void handleTestConnection()} disabled={isSaving || testStatus === "testing"} className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-state-hover transition disabled:opacity-50">
                    {testStatus === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : testStatus === "success" ? <Check className="h-4 w-4 text-emerald-500" /> : testStatus === "error" ? <AlertCircle className="h-4 w-4 text-rose-500" /> : null}
                    {testStatus === "testing" ? "Testing..." : "Test Connection"}
                </button>
                {testMessage && <span className={`text-xs my-auto ${testStatus === "success" ? "text-emerald-500" : "text-rose-500"}`}>{testMessage}</span>}
                <button type="submit" disabled={isSaving} className="rounded-md border border-border-strong bg-bg-elevated px-4 py-2 text-sm font-medium text-text-primary hover:bg-state-hover transition disabled:opacity-50">{isSaving ? "Saving..." : "Save Configuration"}</button>
            </div>
        </form>
    );
}
