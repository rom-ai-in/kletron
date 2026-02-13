import { useEffect, useState, useMemo } from 'react';
import { graphOptions } from "@numezis/shared/graphCatalog";
import { useLlmHealth } from './useLlmHealth';
import type { LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Display labels for each provider (used when building the dynamic options list). */
const PROVIDER_LABELS: Record<string, string> = {
    azure: "Azure OpenAI",
    openai: "OpenAI",
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
    [key: string]: unknown; // each provider key (azure, openai, …) holds its config
};

type AgentGraphRecord = {
    _id?: string;
    name: string;
    description?: string;
};

export interface UseAgentSessionReturn {
    llmProvider: string;
    enabledProviders: LlmProviderType[];
    selectedGraphId: string;
    agentGraphs: AgentGraphRecord[];
    llmConfigData: LlmConfigData | null;
    llmPrefsLoaded: boolean;
    enabledProvidersLoaded: boolean;
    graphOptionsLoaded: boolean;
    llmOptions: { id: string; label: string; sub: string }[];
    graphSelectOptions: { id: string; label: string; sub?: string }[];
    handleLlmChange: (provider: string) => void;
    handleGraphChange: (graphId: string) => void;
    llmStatus: 'success' | 'error' | 'loading' | 'none';
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAgentSession(): UseAgentSessionReturn {
    const [llmProvider, setLlmProvider] = useState<string>('azure');
    const [enabledProviders, setEnabledProviders] = useState<LlmProviderType[]>([]);
    const [llmPrefsLoaded, setLlmPrefsLoaded] = useState(false);
    const [enabledProvidersLoaded, setEnabledProvidersLoaded] = useState(false);
    const [selectedGraphId, setSelectedGraphId] = useState<string>("");
    const [agentGraphs, setAgentGraphs] = useState<AgentGraphRecord[]>([]);
    const [graphOptionsLoaded, setGraphOptionsLoaded] = useState(false);
    const [savedGraphId, setSavedGraphId] = useState<string | null>(null);
    const [llmConfigData, setLlmConfigData] = useState<LlmConfigData | null>(null);

    const { status: llmStatus } = useLlmHealth(llmProvider);

    // ── Fetch LLM config + user preferences (LLM provider + graph selection)
    useEffect(() => {
        const fetchPreferences = async () => {
            try {
                // Fetch full LLM config (contains all provider configs + model names)
                const configRes = await fetch("/api/llm-config");
                const configData: LlmConfigData = configRes.ok ? await configRes.json() : {};
                setLlmConfigData(configData);

                const defaultProvider = (configData.provider ?? configData.defaultProvider ?? 'azure') as string;

                // Try to fetch user preferences from API
                const prefsRes = await fetch("/api/user-preferences");
                if (prefsRes.ok) {
                    const prefsData = await prefsRes.json();
                    if (prefsData.success && prefsData.preferences) {
                        const { selectedLlmProvider, selectedGraphId: prefGraphId } = prefsData.preferences;
                        if (selectedLlmProvider) {
                            setLlmProvider(selectedLlmProvider);
                        } else {
                            // Fallback to localStorage then config default
                            const stored = window.localStorage.getItem("numezis-llm-selection");
                            if (stored) {
                                try {
                                    const parsed = JSON.parse(stored);
                                    if (parsed.provider) setLlmProvider(parsed.provider);
                                } catch { }
                            } else {
                                setLlmProvider(defaultProvider);
                            }
                        }
                        if (prefGraphId) {
                            setSavedGraphId(prefGraphId);
                        } else {
                            // Fallback to localStorage
                            const storedGraph = window.localStorage.getItem("numezis-graph-selection");
                            if (storedGraph) {
                                setSavedGraphId(storedGraph);
                            }
                        }
                        return;
                    }
                }

                // Fallback to localStorage if API fails or user not authenticated
                const stored = window.localStorage.getItem("numezis-llm-selection");
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed.provider) setLlmProvider(parsed.provider);
                    } catch { }
                } else {
                    setLlmProvider(defaultProvider);
                }

                const storedGraph = window.localStorage.getItem("numezis-graph-selection");
                if (storedGraph) {
                    setSavedGraphId(storedGraph);
                }
            } catch (e) {
                console.error("Failed to fetch preferences", e);
            } finally {
                setLlmPrefsLoaded(true);
            }
        };
        fetchPreferences();
    }, []);

    // ── Load agent graphs from API ───────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const loadGraphs = async () => {
            try {
                const res = await fetch("/api/agent-graphs", { cache: "no-store" });
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
    }, []);

    // ── Resolve selected graph once graphs AND preferences are loaded ───
    // IMPORTANT: Do NOT include `selectedGraphId` in the dependency array.
    // This effect only runs for *initial* resolution (when graphs load or
    // savedGraphId arrives from the API).  User-initiated changes via
    // handleGraphChange must not be overridden.
    // We gate on `llmPrefsLoaded` to avoid a race condition where graphs
    // load before preferences, causing the default to be picked instead
    // of the user's saved selection.
    useEffect(() => {
        if (!graphOptionsLoaded || !llmPrefsLoaded) return;
        const hasAgentGraphs = agentGraphs.length > 0;
        const defaultGraphId = hasAgentGraphs
            ? String(
                  agentGraphs.find((g) => g.name === "Simple ReAct (agent graph)")?._id ??
                  agentGraphs[0]?._id ??
                  ""
              )
            : (graphOptions[0]?.id || "universal-v1");
        const savedIsValid = savedGraphId
            ? hasAgentGraphs
                ? agentGraphs.some((g) => String(g._id) === savedGraphId)
                : graphOptions.some((g) => g.id === savedGraphId)
            : false;
        const nextGraphId = savedIsValid ? savedGraphId! : defaultGraphId;
        if (nextGraphId) {
            setSelectedGraphId((prev) => (prev && prev !== "" ? prev : nextGraphId));
        }
    }, [graphOptionsLoaded, llmPrefsLoaded, agentGraphs, savedGraphId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Fetch enabled LLM providers ──────────────────────────────────────
    useEffect(() => {
        fetch("/api/llm-config/enable")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data.enabledProviders)) {
                    setEnabledProviders(data.enabledProviders);
                } else {
                    setEnabledProviders([]);
                }
            })
            .catch((err) => {
                console.error("Failed to fetch enabled providers", err);
                setEnabledProviders([]);
            })
            .finally(() => {
                setEnabledProvidersLoaded(true);
            });
    }, []);

    // ── Auto-correct provider if current selection is disabled ───────────
    // We gate on `llmPrefsLoaded` to avoid overwriting the user's saved
    // preference when enabled providers load before preferences (the initial
    // 'azure' value might not be in the enabled list, causing a premature
    // auto-correct that persists over the real saved preference).
    useEffect(() => {
        if (!enabledProvidersLoaded || !llmPrefsLoaded || enabledProviders.length === 0) return;
        if (!enabledProviders.includes(llmProvider as LlmProviderType)) {
            const nextProvider = enabledProviders[0];
            if (nextProvider) {
                handleLlmChange(nextProvider);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabledProvidersLoaded, llmPrefsLoaded, enabledProviders, llmProvider]);

    // ── Handlers ─────────────────────────────────────────────────────────

    const handleLlmChange = (provider: string) => {
        setLlmProvider(provider);
        // Resolve model name from config data
        const providerConfig = llmConfigData?.[provider] as Record<string, unknown> | undefined;
        const model = (providerConfig?.model ?? providerConfig?.deployment ?? '') as string;
        // Save to localStorage as fallback
        window.localStorage.setItem(
            "numezis-llm-selection",
            JSON.stringify({ provider, model })
        );
        // Persist to API (fire-and-forget, don't block UI)
        fetch("/api/user-preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedLlmProvider: provider }),
        }).catch(() => { /* Silently fail, localStorage is fallback */ });
    };

    const handleGraphChange = (graphId: string) => {
        setSelectedGraphId(graphId);
        // Keep savedGraphId in sync so the resolve effect doesn't revert
        setSavedGraphId(graphId);
        // Save to localStorage as fallback
        window.localStorage.setItem("numezis-graph-selection", graphId);
        // Persist to API (fire-and-forget, don't block UI)
        fetch("/api/user-preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedGraphId: graphId }),
        }).catch(() => { /* Silently fail, localStorage is fallback */ });
    };

    // ── Derived data ─────────────────────────────────────────────────────

    /** Build LLM options dynamically from enabledProviders + llmConfigData. */
    const llmOptions = useMemo(() =>
        enabledProviders.map((providerId) => {
            const cfg = llmConfigData?.[providerId] as Record<string, unknown> | undefined;
            const model = (cfg?.model ?? cfg?.deployment ?? '') as string;
            return {
                id: providerId,
                label: PROVIDER_LABELS[providerId] ?? providerId,
                sub: model || 'Not configured',
            };
        }),
    [enabledProviders, llmConfigData]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graphSelectOptions = useMemo(() => (agentGraphs.length > 0 ? agentGraphs : graphOptions).map((g: any) => ({
        id: String(g._id ?? g.id ?? ""),
        label: g.name,
        sub: g.description,
    })).filter((g) => g.id), [agentGraphs]);

    return {
        llmProvider,
        enabledProviders,
        selectedGraphId,
        agentGraphs,
        llmConfigData,
        llmPrefsLoaded,
        enabledProvidersLoaded,
        graphOptionsLoaded,
        llmOptions,
        graphSelectOptions,
        handleLlmChange,
        handleGraphChange,
        llmStatus,
    };
}
