import { useState } from "react";
import { Check, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { EMBEDDING_MODEL_RECOMMENDATIONS, EmbeddingProviderType } from "@kletron/shared/schemas/embeddingConfig.schema";

// ============================================
// Shared Form Field Styles
// ============================================
const inputClass = "w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong";
const labelClass = "block text-[11px] text-text-muted mb-1";

// ============================================
// Azure Embedding Config Form
// ============================================
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
    const testState = useTestConnection("azure");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTestConnection = () => void testState.test({
        endpoint,
        deployment,
        model,
        apiVersion,
        apiKey: apiKey.includes("•") ? undefined : apiKey,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);
        try {
            await onSave({ endpoint, deployment, model, apiVersion, apiKey: apiKey.includes("•") ? "" : apiKey });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className={labelClass}>Endpoint URL</label>
                    <input type="url" required className={inputClass} placeholder="https://your-resource.cognitiveservices.azure.com" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
                </div>
                <div>
                    <label className={labelClass}>Deployment Name</label>
                    <input type="text" required className={inputClass} value={deployment} onChange={(e) => setDeployment(e.target.value)} />
                </div>
                <div>
                    <label className={labelClass}>Model Name</label>
                    <ModelSelect provider="azure" value={model} onChange={setModel} />
                </div>
                <div>
                    <label className={labelClass}>API Version</label>
                    <input type="text" required className={inputClass} value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} />
                </div>
                <div>
                    <label className={labelClass}>API Key</label>
                    <PasswordInput value={apiKey} onChange={setApiKey} show={showApiKey} onToggle={() => setShowApiKey(!showApiKey)} required={!initialConfig?.apiKey} />
                </div>
            </div>
            {error && <p className="text-xs text-status-error-text">{error}</p>}
            <FormButtons onCancel={onCancel} testState={testState} onTest={handleTestConnection} isSaving={isSaving} />
        </form>
    );
}

// ============================================
// OpenAI Embedding Config Form
// ============================================
type OpenAIEmbeddingConfigFormProps = {
    initialConfig?: { apiKey?: string; model: string; dimensions?: number; organization?: string };
    onSave: (config: { apiKey: string; model: string; dimensions?: number; organization?: string }) => Promise<void>;
    onCancel: () => void;
};

export function OpenAIEmbeddingConfigForm({ initialConfig, onSave, onCancel }: OpenAIEmbeddingConfigFormProps) {
    const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");
    const [model, setModel] = useState(initialConfig?.model ?? "text-embedding-3-small");
    const [dimensions, setDimensions] = useState<number | undefined>(initialConfig?.dimensions);
    const [organization, setOrganization] = useState(initialConfig?.organization ?? "");
    const [showApiKey, setShowApiKey] = useState(false);
    const testState = useTestConnection("openai");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTestConnection = () => void testState.test({
        apiKey: apiKey.includes("•") ? undefined : apiKey,
        model,
        dimensions,
        organization: organization || undefined,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);
        try {
            await onSave({ apiKey: apiKey.includes("•") ? "" : apiKey, model, dimensions, organization: organization || undefined });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className={labelClass}>API Key</label>
                    <PasswordInput value={apiKey} onChange={setApiKey} show={showApiKey} onToggle={() => setShowApiKey(!showApiKey)} required={!initialConfig?.apiKey} />
                </div>
                <div>
                    <label className={labelClass}>Model</label>
                    <ModelSelect provider="openai" value={model} onChange={setModel} />
                </div>
                <div>
                    <label className={labelClass}>Dimensions (optional)</label>
                    <input type="number" className={inputClass} placeholder="Auto" value={dimensions ?? ""} onChange={(e) => setDimensions(e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
                <div className="col-span-2">
                    <label className={labelClass}>Organization ID (optional)</label>
                    <input type="text" className={inputClass} placeholder="org-xxx" value={organization} onChange={(e) => setOrganization(e.target.value)} />
                </div>
            </div>
            {error && <p className="text-xs text-status-error-text">{error}</p>}
            <FormButtons onCancel={onCancel} testState={testState} onTest={handleTestConnection} isSaving={isSaving} />
        </form>
    );
}

// ============================================
// Voyage Embedding Config Form
// ============================================
type VoyageEmbeddingConfigFormProps = {
    initialConfig?: { apiKey?: string; model: string; inputType?: "query" | "document" };
    onSave: (config: { apiKey: string; model: string; inputType?: "query" | "document" }) => Promise<void>;
    onCancel: () => void;
};

export function VoyageEmbeddingConfigForm({ initialConfig, onSave, onCancel }: VoyageEmbeddingConfigFormProps) {
    const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");
    const [model, setModel] = useState(initialConfig?.model ?? "voyage-3");
    const [inputType, setInputType] = useState<"query" | "document" | "">(initialConfig?.inputType ?? "");
    const [showApiKey, setShowApiKey] = useState(false);
    const testState = useTestConnection("voyage");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTestConnection = () => void testState.test({
        apiKey: apiKey.includes("•") ? undefined : apiKey,
        model,
        inputType: inputType || undefined,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);
        try {
            await onSave({ apiKey: apiKey.includes("•") ? "" : apiKey, model, inputType: inputType || undefined });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className={labelClass}>API Key</label>
                    <PasswordInput value={apiKey} onChange={setApiKey} show={showApiKey} onToggle={() => setShowApiKey(!showApiKey)} required={!initialConfig?.apiKey} />
                </div>
                <div>
                    <label className={labelClass}>Model</label>
                    <ModelSelect provider="voyage" value={model} onChange={setModel} />
                </div>
                <div>
                    <label className={labelClass}>Input Type (optional)</label>
                    <select className={inputClass} value={inputType} onChange={(e) => setInputType(e.target.value as "query" | "document" | "")}>
                        <option value="">Auto</option>
                        <option value="query">Query</option>
                        <option value="document">Document</option>
                    </select>
                </div>
            </div>
            <p className="text-xs text-text-muted">Voyage AI is Anthropic's recommended embedding provider for Claude.</p>
            {error && <p className="text-xs text-status-error-text">{error}</p>}
            <FormButtons onCancel={onCancel} testState={testState} onTest={handleTestConnection} isSaving={isSaving} />
        </form>
    );
}

// ============================================
// Gemini Embedding Config Form
// ============================================
type GeminiEmbeddingConfigFormProps = {
    initialConfig?: { apiKey?: string; model: string; taskType?: string };
    onSave: (config: { apiKey: string; model: string; taskType?: string }) => Promise<void>;
    onCancel: () => void;
};

export function GeminiEmbeddingConfigForm({ initialConfig, onSave, onCancel }: GeminiEmbeddingConfigFormProps) {
    const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");
    const [model, setModel] = useState(initialConfig?.model ?? "text-embedding-004");
    const [taskType, setTaskType] = useState(initialConfig?.taskType ?? "");
    const [showApiKey, setShowApiKey] = useState(false);
    const testState = useTestConnection("gemini");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTestConnection = () => void testState.test({
        apiKey: apiKey.includes("•") ? undefined : apiKey,
        model,
        taskType: taskType || undefined,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);
        try {
            await onSave({ apiKey: apiKey.includes("•") ? "" : apiKey, model, taskType: taskType || undefined });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className={labelClass}>API Key</label>
                    <PasswordInput value={apiKey} onChange={setApiKey} show={showApiKey} onToggle={() => setShowApiKey(!showApiKey)} required={!initialConfig?.apiKey} />
                </div>
                <div>
                    <label className={labelClass}>Model</label>
                    <ModelSelect provider="gemini" value={model} onChange={setModel} />
                </div>
                <div>
                    <label className={labelClass}>Task Type (optional)</label>
                    <select className={inputClass} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                        <option value="">Auto</option>
                        <option value="RETRIEVAL_QUERY">Retrieval Query</option>
                        <option value="RETRIEVAL_DOCUMENT">Retrieval Document</option>
                        <option value="SEMANTIC_SIMILARITY">Semantic Similarity</option>
                        <option value="CLASSIFICATION">Classification</option>
                        <option value="CLUSTERING">Clustering</option>
                    </select>
                </div>
            </div>
            {error && <p className="text-xs text-status-error-text">{error}</p>}
            <FormButtons onCancel={onCancel} testState={testState} onTest={handleTestConnection} isSaving={isSaving} />
        </form>
    );
}

// ============================================
// LM Studio Embedding Config Form
// ============================================
type LMStudioEmbeddingConfigFormProps = {
    initialConfig?: { baseUrl: string; model: string; apiKey?: string; dimensions?: number };
    onSave: (config: { baseUrl: string; model: string; apiKey?: string; dimensions: number }) => Promise<void>;
    onCancel: () => void;
};

export function LMStudioEmbeddingConfigForm({ initialConfig, onSave, onCancel }: LMStudioEmbeddingConfigFormProps) {
    const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "http://127.0.0.1:1234/v1");
    const [model, setModel] = useState(initialConfig?.model ?? "");
    const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");
    const [dimensions, setDimensions] = useState(initialConfig?.dimensions ?? 1536);
    const [showApiKey, setShowApiKey] = useState(false);
    const testState = useTestConnection("lmstudio");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTestConnection = () => void testState.test({ baseUrl, model, apiKey: apiKey || undefined });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);
        try {
            await onSave({ baseUrl, model, apiKey: apiKey.includes("•") ? "" : (apiKey || undefined), dimensions });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className={labelClass}>Base URL</label>
                    <input type="url" required className={inputClass} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                </div>
                <div>
                    <label className={labelClass}>Model ID</label>
                    <ModelSelect provider="lmstudio" value={model} onChange={setModel} allowCustom />
                </div>
                <div>
                    <label className={labelClass}>Expected Dimensions</label>
                    <input type="number" required className={inputClass} value={dimensions} onChange={(e) => setDimensions(parseInt(e.target.value))} />
                </div>
                <div className="col-span-2">
                    <label className={labelClass}>API Key (optional)</label>
                    <PasswordInput value={apiKey} onChange={setApiKey} show={showApiKey} onToggle={() => setShowApiKey(!showApiKey)} placeholder="lm-studio" />
                </div>
            </div>
            {error && <p className="text-xs text-status-error-text">{error}</p>}
            <FormButtons onCancel={onCancel} testState={testState} onTest={handleTestConnection} isSaving={isSaving} />
        </form>
    );
}

// ============================================
// Ollama Embedding Config Form
// ============================================
type OllamaEmbeddingConfigFormProps = {
    initialConfig?: { baseUrl: string; model: string };
    onSave: (config: { baseUrl: string; model: string }) => Promise<void>;
    onCancel: () => void;
};

export function OllamaEmbeddingConfigForm({ initialConfig, onSave, onCancel }: OllamaEmbeddingConfigFormProps) {
    const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "http://127.0.0.1:11434");
    const [model, setModel] = useState(initialConfig?.model ?? "nomic-embed-text");
    const testState = useTestConnection("ollama");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTestConnection = () => void testState.test({ baseUrl, model });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);
        try {
            await onSave({ baseUrl, model });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className={labelClass}>Base URL</label>
                    <input type="url" required className={inputClass} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                </div>
                <div className="col-span-2">
                    <label className={labelClass}>Model</label>
                    <ModelSelect provider="ollama" value={model} onChange={setModel} allowCustom />
                </div>
            </div>
            <p className="text-xs text-text-muted">Make sure the embedding model is pulled: <code className="bg-bg-surface px-1 rounded">ollama pull {model}</code></p>
            {error && <p className="text-xs text-status-error-text">{error}</p>}
            <FormButtons onCancel={onCancel} testState={testState} onTest={handleTestConnection} isSaving={isSaving} />
        </form>
    );
}

// ============================================
// Shared Components
// ============================================

function PasswordInput({ value, onChange, show, onToggle, required, placeholder }: {
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    onToggle: () => void;
    required?: boolean;
    placeholder?: string;
}) {
    return (
        <div className="relative">
            <input
                type={show ? "text" : "password"}
                required={required}
                placeholder={placeholder}
                className={`${inputClass} pr-10`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </div>
    );
}

function ModelSelect({ provider, value, onChange, allowCustom }: {
    provider: EmbeddingProviderType;
    value: string;
    onChange: (v: string) => void;
    allowCustom?: boolean;
}) {
    const models = EMBEDDING_MODEL_RECOMMENDATIONS[provider] ?? [];
    const isCustom = value && !models.includes(value);
    const [custom, setCustom] = useState(isCustom ? value : "");

    return (
        <div className="relative">
            {allowCustom || isCustom ? (
                <input
                    type="text"
                    required
                    className={inputClass}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    list={`models-${provider}`}
                />
            ) : (
                <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
                    {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
            )}
            <datalist id={`models-${provider}`}>
                {models.map((m) => <option key={m} value={m} />)}
            </datalist>
        </div>
    );
}

function FormButtons({ onCancel, testState, onTest, isSaving }: {
    onCancel: () => void;
    testState: ReturnType<typeof useTestConnection>;
    onTest: () => void;
    isSaving: boolean;
}) {
    return (
        <div className="flex justify-end gap-2 pt-2 flex-wrap">
            <button type="button" onClick={onCancel} disabled={isSaving} className="rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-state-hover transition disabled:opacity-50">Cancel</button>
            <button type="button" onClick={onTest} disabled={isSaving || testState.status === "testing"} className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-state-hover transition disabled:opacity-50">
                {testState.status === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : testState.status === "success" ? <Check className="h-4 w-4 text-status-success-text" /> : testState.status === "error" ? <AlertCircle className="h-4 w-4 text-status-error-text" /> : null}
                {testState.status === "testing" ? "Testing..." : "Test Connection"}
            </button>
            {testState.message && <span className={`text-xs my-auto ${testState.status === "success" ? "text-status-success-text" : "text-status-error-text"}`}>{testState.message}</span>}
            <button type="submit" disabled={isSaving} className="rounded-md border border-border-strong bg-bg-elevated px-4 py-2 text-sm font-medium text-text-primary hover:bg-state-hover transition disabled:opacity-50">{isSaving ? "Saving..." : "Save Configuration"}</button>
        </div>
    );
}

function useTestConnection(provider: EmbeddingProviderType) {
    const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const test = async (config: any) => {
        setStatus("testing");
        setMessage("");
        try {
            const res = await fetch("/api/embedding-config/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider, config }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Connection failed");
            setStatus("success");
            setMessage(`Success! Latency: ${data.latency}ms (${data.dimensions} dims)`);
        } catch (err) {
            setStatus("error");
            setMessage(err instanceof Error ? err.message : "Connection failed");
        }
    };

    return { status, message, test };
}
