import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { apiFetch, type GetRequestHeaders } from '@kletron/shared';
import { useLlmHealth } from './useLlmHealth';
import type { LlmProviderType } from "@kletron/shared/schemas/llmConfig.schema";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Display labels for each provider (used when building the dynamic options list). */
const PROVIDER_LABELS: Record<string, string> = {
    azure: "Azure",
    openai: "OpenAI",
    codex: "Codex",
    claude: "Claude",
    gemini: "Gemini",
    lmstudio: "LM Studio",
    ollama: "Ollama",
    vllm: "vLLM",
};

/** Full LLM config shape returned by GET /api/llm-config */
type LlmConfigData = {
    provider?: string;
    defaultProvider?: string;
    enabledProviders?: string[];
    [key: string]: unknown;
};

type AgentGraphRecord = {
    _id?: string;
    name: string;
    description?: string;
};

/** Persisted `agent_graphs._id` only (24 hex). Legacy catalog slugs are rejected. */
const MONGO_GRAPH_ID_HEX24 = /^[0-9a-fA-F]{24}$/;

function takeValidStoredGraphSelection(): string | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem("kletron-graph-selection");
    if (!raw) return null;
    if (!MONGO_GRAPH_ID_HEX24.test(raw)) {
        window.localStorage.removeItem("kletron-graph-selection");
        return null;
    }
    return raw;
}

export interface UseAgentSessionOptions {
    /** When set (e.g. Electron), prepended to `/api/...` paths. No trailing slash. */
    apiOrigin?: string;
    /** Extra headers (Bearer, x-workspace-id, etc.). */
    getRequestHeaders?: GetRequestHeaders;
}

export interface UseAgentSessionReturn {
    llmProvider: string;
    selectedCodexModel: string;
    enabledProviders: LlmProviderType[];
    selectedGraphId: string;
    agentGraphs: AgentGraphRecord[];
    /** Re-fetch `/api/agent-graphs` (e.g. after creating a graph in the editor). */
    refreshGraphs: () => void;
    /** Re-fetch LLM config + user preferences (e.g. after Settings saved a model). */
    refreshLlmPreferences: () => void;
    llmConfigData: LlmConfigData | null;
    llmPrefsLoaded: boolean;
    enabledProvidersLoaded: boolean;
    graphOptionsLoaded: boolean;
    llmOptions: { id: string; label: string; sub: string }[];
    graphSelectOptions: { id: string; label: string; sub?: string }[];
    handleLlmChange: (provider: string) => void;
    handleGraphChange: (graphId: string) => void;
    handleCodexModelChange: (model: string) => void;
    llmStatus: 'success' | 'error' | 'loading' | 'none';
    /** Human-readable reason for llmStatus (e.g. from health check). Hover LLM selector to see. */
    llmStatusDetail: string | null;
    /** True until LLM prefs + enabled-provider list are loaded — show selector skeleton, not a guessed provider. */
    llmSelectorLoading: boolean;
    /** True until graphs + LLM prefs resolved — matches desktop graph gate; use for GRAPH selector skeleton. */
    graphSelectorLoading: boolean;
    /** Codex CLI model list (`/api/codex/models`) for the provider/model strip. */
    codexModelOptions: { id: string; label: string; sub?: string }[];
    codexModelsLoading: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

function normalizeCodexModelsPayload(input: unknown): { id: string; label: string }[] {
    const obj = input as { models?: unknown } | null | undefined;
    const raw: unknown[] = Array.isArray(obj?.models)
        ? (obj.models as unknown[])
        : Array.isArray(input)
          ? (input as unknown[])
          : [];
    const out: { id: string; label: string }[] = [];
    for (const item of raw) {
        if (!item || typeof item !== "object") continue;
        const id = typeof (item as { id?: string }).id === "string" ? (item as { id: string }).id : "";
        if (!id) continue;
        const label =
            typeof (item as { displayName?: string }).displayName === "string"
                ? (item as { displayName: string }).displayName
                : typeof (item as { name?: string }).name === "string"
                  ? (item as { name: string }).name
                  : id;
        out.push({ id, label });
    }
    return out;
}

export function useAgentSession(options?: UseAgentSessionOptions): UseAgentSessionReturn {
    const apiOrigin = options?.apiOrigin;
    const getRequestHeadersRef = useRef(options?.getRequestHeaders);
    getRequestHeadersRef.current = options?.getRequestHeaders;

    const getHdr = useCallback(async () => {
        const fn = getRequestHeadersRef.current;
        if (!fn) return {};
        return { ...(await fn()) };
    }, []);

    const [llmProvider, setLlmProvider] = useState<string>('');
    const [selectedCodexModel, setSelectedCodexModel] = useState<string>("");
    const [enabledProviders, setEnabledProviders] = useState<LlmProviderType[]>([]);
    const [llmPrefsLoaded, setLlmPrefsLoaded] = useState(false);
    const [enabledProvidersLoaded, setEnabledProvidersLoaded] = useState(false);
    const [selectedGraphId, setSelectedGraphId] = useState<string>("");
    const [agentGraphs, setAgentGraphs] = useState<AgentGraphRecord[]>([]);
    const [graphOptionsLoaded, setGraphOptionsLoaded] = useState(false);
    const [savedGraphId, setSavedGraphId] = useState<string | null>(null);
    const [llmConfigData, setLlmConfigData] = useState<LlmConfigData | null>(null);
    const [graphsReloadNonce, setGraphsReloadNonce] = useState(0);
    const refreshGraphs = useCallback(() => setGraphsReloadNonce((n) => n + 1), []);
    const [llmPrefsReloadNonce, setLlmPrefsReloadNonce] = useState(0);
    const refreshLlmPreferences = useCallback(() => setLlmPrefsReloadNonce((n) => n + 1), []);
    const [codexModelOptions, setCodexModelOptions] = useState<{ id: string; label: string }[]>([]);
    const [codexModelsLoading, setCodexModelsLoading] = useState(false);

    const { status: llmStatus, message: llmStatusDetail } = useLlmHealth(llmProvider, {
        apiOrigin,
        getRequestHeaders: getHdr,
    });

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            if (!llmPrefsLoaded) return;
            setCodexModelsLoading(true);
            try {
                const res = await apiFetch({
                    apiOrigin,
                    path: "/api/codex/models",
                    getRequestHeaders: getHdr,
                    method: "GET",
                    cache: "no-store",
                });
                const data = res.ok ? await res.json().catch(() => null) : null;
                const list = normalizeCodexModelsPayload(data);
                if (!cancelled) setCodexModelOptions(list);
            } catch {
                if (!cancelled) setCodexModelOptions([]);
            } finally {
                if (!cancelled) setCodexModelsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [llmPrefsLoaded, apiOrigin, getHdr, llmPrefsReloadNonce]);

    // ── Fetch LLM config + user preferences (LLM provider + graph selection)
    useEffect(() => {
        const fetchPreferences = async () => {
            try {
                const configRes = await apiFetch({
                    apiOrigin,
                    path: "/api/llm-config",
                    getRequestHeaders: getHdr,
                    method: "GET",
                });
                const configData: LlmConfigData = configRes.ok ? await configRes.json() : {};
                setLlmConfigData(configData);

                const defaultProvider = (configData.provider ?? configData.defaultProvider ?? 'azure') as string;

                const prefsRes = await apiFetch({
                    apiOrigin,
                    path: "/api/user-preferences",
                    getRequestHeaders: getHdr,
                    method: "GET",
                });
                if (prefsRes.ok) {
                    const prefsData = await prefsRes.json();
                    if (prefsData.success && prefsData.preferences) {
                        const {
                            selectedLlmProvider,
                            selectedGraphId: prefGraphId,
                            selectedCodexModel: prefCodexModel,
                        } = prefsData.preferences;
                        if (selectedLlmProvider) {
                            setLlmProvider(selectedLlmProvider);
                        } else {
                            const stored = window.localStorage.getItem("kletron-llm-selection");
                            if (stored) {
                                try {
                                    const parsed = JSON.parse(stored);
                                    if (parsed.provider) setLlmProvider(parsed.provider);
                                } catch { /* ignore */ }
                            } else {
                                setLlmProvider(defaultProvider);
                            }
                        }
                        if (prefGraphId && MONGO_GRAPH_ID_HEX24.test(prefGraphId)) {
                            setSavedGraphId(prefGraphId);
                        } else {
                            const cleaned = takeValidStoredGraphSelection();
                            if (cleaned) setSavedGraphId(cleaned);
                        }
                        if (typeof prefCodexModel === "string") {
                            setSelectedCodexModel(prefCodexModel);
                        } else {
                            const localCodexModel = window.localStorage.getItem("kletron-codex-model");
                            if (localCodexModel) setSelectedCodexModel(localCodexModel);
                        }
                        return;
                    }
                }

                const stored = window.localStorage.getItem("kletron-llm-selection");
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed.provider) setLlmProvider(parsed.provider);
                    } catch { /* ignore */ }
                } else {
                    setLlmProvider(defaultProvider);
                }

                const cleanedGraph = takeValidStoredGraphSelection();
                if (cleanedGraph) setSavedGraphId(cleanedGraph);
                const localCodexModel = window.localStorage.getItem("kletron-codex-model");
                if (localCodexModel) setSelectedCodexModel(localCodexModel);
            } catch (e) {
                console.error("Failed to fetch preferences", e);
            } finally {
                setLlmPrefsLoaded(true);
            }
        };
        void fetchPreferences();
    }, [apiOrigin, getHdr, llmPrefsReloadNonce]);

    // ── Load agent graphs from API ───────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const loadGraphs = async () => {
            try {
                const res = await apiFetch({
                    apiOrigin,
                    path: "/api/agent-graphs",
                    getRequestHeaders: getHdr,
                    method: "GET",
                    cache: "no-store",
                });
                if (!res.ok) throw new Error("Failed to load graphs");
                const data = await res.json();
                const list = Array.isArray(data?.graphs) ? (data.graphs as AgentGraphRecord[]) : [];
                if (!cancelled) {
                    setAgentGraphs(list);
                    setGraphOptionsLoaded(true);
                }
            } catch {
                if (!cancelled) {
                    setAgentGraphs([]);
                    setGraphOptionsLoaded(true);
                }
            }
        };
        void loadGraphs();
        return () => {
            cancelled = true;
        };
    }, [apiOrigin, getHdr, graphsReloadNonce]);

    // ── Resolve selected graph once graphs AND preferences are loaded ───
    // Only real `agent_graphs` Mongo ids are valid — never catalog slugs (e.g. universal-v1).
    useEffect(() => {
        if (!graphOptionsLoaded || !llmPrefsLoaded) return;
        const hasAgentGraphs = agentGraphs.length > 0;
        const defaultGraphId = (() => {
            if (!hasAgentGraphs) return "";
            const priority = [
                "Coder Agent (agent graph)",
                "Explorer Agent (agent graph)",
                "Planner Agent (agent graph)",
                "Company Growth & GTM (work graph)",
            ] as const;
            for (const name of priority) {
                const g = agentGraphs.find((x) => x.name === name);
                if (g?._id) return String(g._id);
            }
            return agentGraphs[0]?._id ? String(agentGraphs[0]._id) : "";
        })();
        const savedIsValid = Boolean(
            savedGraphId &&
                MONGO_GRAPH_ID_HEX24.test(savedGraphId) &&
                hasAgentGraphs &&
                agentGraphs.some((g) => String(g._id) === savedGraphId),
        );
        const nextGraphId = savedIsValid ? savedGraphId! : defaultGraphId;
        if (nextGraphId) {
            setSelectedGraphId((prev) => (prev && prev !== "" ? prev : nextGraphId));
        }
    }, [graphOptionsLoaded, llmPrefsLoaded, agentGraphs, savedGraphId]);  

    // ── Fetch enabled LLM providers ──────────────────────────────────────
    useEffect(() => {
        void (async () => {
            try {
                const res = await apiFetch({
                    apiOrigin,
                    path: "/api/llm-config/enable",
                    getRequestHeaders: getHdr,
                    method: "GET",
                });
                const data = await res.json();
                if (Array.isArray(data.enabledProviders)) {
                    setEnabledProviders(data.enabledProviders);
                } else {
                    setEnabledProviders([]);
                }
            } catch (err) {
                console.error("Failed to fetch enabled providers", err);
                setEnabledProviders([]);
            } finally {
                setEnabledProvidersLoaded(true);
            }
        })();
    }, [apiOrigin, getHdr]);

    const handleLlmChange = useCallback((provider: string) => {
        setLlmProvider(provider);
        const providerConfig = llmConfigData?.[provider] as Record<string, unknown> | undefined;
        const model = (providerConfig?.model ?? providerConfig?.deployment ?? '') as string;
        window.localStorage.setItem(
            "kletron-llm-selection",
            JSON.stringify({ provider, model })
        );
        void apiFetch({
            apiOrigin,
            path: "/api/user-preferences",
            getRequestHeaders: getHdr,
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedLlmProvider: provider }),
        }).catch(() => { /* Silently fail, localStorage is fallback */ });
    }, [apiOrigin, getHdr, llmConfigData]);

    const handleGraphChange = useCallback((graphId: string) => {
        setSelectedGraphId(graphId);
        setSavedGraphId(graphId);
        window.localStorage.setItem("kletron-graph-selection", graphId);
        void apiFetch({
            apiOrigin,
            path: "/api/user-preferences",
            getRequestHeaders: getHdr,
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedGraphId: graphId }),
        }).catch(() => { /* Silently fail, localStorage is fallback */ });
    }, [apiOrigin, getHdr]);

    const handleCodexModelChange = useCallback((model: string) => {
        const sanitized = model.trim();
        setSelectedCodexModel(sanitized);
        window.localStorage.setItem("kletron-codex-model", sanitized);
        void apiFetch({
            apiOrigin,
            path: "/api/user-preferences",
            getRequestHeaders: getHdr,
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedCodexModel: sanitized || null }),
        }).catch(() => { /* localStorage fallback */ });
    }, [apiOrigin, getHdr]);

    // ── Auto-correct provider if current selection is disabled ───────────
    useEffect(() => {
        if (!enabledProvidersLoaded || !llmPrefsLoaded || enabledProviders.length === 0) return;
        if (!enabledProviders.includes(llmProvider as LlmProviderType)) {
            const nextProvider = enabledProviders[0];
            if (nextProvider) {
                handleLlmChange(nextProvider);
            }
        }
    }, [enabledProvidersLoaded, llmPrefsLoaded, enabledProviders, llmProvider, handleLlmChange]);

    const llmOptions = useMemo(() => {
        const ids: string[] =
            enabledProviders.length > 0
                ? [...enabledProviders]
                : llmProvider
                  ? [llmProvider]
                  : [];
        return ids.map((providerId) => {
            const cfg = llmConfigData?.[providerId] as Record<string, unknown> | undefined;
            const model = (cfg?.model ?? cfg?.deployment ?? "") as string;
            return {
                id: providerId,
                label: PROVIDER_LABELS[providerId] ?? providerId,
                sub: model || "Not configured",
            };
        });
    }, [enabledProviders, llmConfigData, llmProvider]);

    const graphSelectOptions = useMemo(
        () =>
            agentGraphs
                .map((g) => ({
                    id: String(g._id ?? ""),
                    label: g.name,
                }))
                .filter((g) => g.id),
        [agentGraphs],
    );

    const llmSelectorLoading = !llmPrefsLoaded || !enabledProvidersLoaded;
    const graphSelectorLoading = !graphOptionsLoaded || !llmPrefsLoaded;

    return {
        llmProvider,
        selectedCodexModel,
        enabledProviders,
        selectedGraphId,
        agentGraphs,
        refreshGraphs,
        refreshLlmPreferences,
        llmConfigData,
        llmPrefsLoaded,
        enabledProvidersLoaded,
        graphOptionsLoaded,
        llmOptions,
        graphSelectOptions,
        handleLlmChange,
        handleGraphChange,
        handleCodexModelChange,
        llmStatus,
        llmStatusDetail,
        llmSelectorLoading,
        graphSelectorLoading,
        codexModelOptions,
        codexModelsLoading,
    };
}
