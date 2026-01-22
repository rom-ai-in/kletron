import { useState } from "react";

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
    const [apiKey, setApiKey] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                apiKey,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
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
                    API Key {initialConfig?.apiKey && <span className="text-text-muted">(leave empty to keep current)</span>}
                </label>
                <input
                    id="azure-api-key"
                    type="password"
                    required={!initialConfig?.apiKey}
                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                    placeholder={initialConfig?.apiKey ? "••••••••" : "Enter API key"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
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
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);

        try {
            await onSave({
                baseUrl,
                model,
                apiKey: apiKey || undefined,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
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
                <input
                    id="lmstudio-api-key"
                    type="password"
                    className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                    placeholder="lm-studio"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
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
