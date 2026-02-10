import { useEffect, useState, useMemo } from 'react';
import { graphOptions } from "@numezis/shared/graphCatalog";
import { useLlmHealth } from './useLlmHealth';
import type { LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";

// ─── Types ──────────────────────────────────────────────────────────────────

type LlmEnvInfo = {
    defaultProvider?: "azure" | "lmstudio";
    azure?: {
        configured: boolean;
        endpoint?: string | null;
        deployment?: string | null;
        model?: string | null;
        apiVersion?: string | null;
    };
    lmstudio?: {
        configured: boolean;
        baseUrl?: string | null;
        model?: string | null;
    };
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
    envInfo: LlmEnvInfo | null;
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
    const [envInfo, setEnvInfo] = useState<LlmEnvInfo | null>(null);

    const { status: llmStatus } = useLlmHealth(llmProvider);

    // ── Fetch user preferences (LLM provider + graph selection) ──────────
    useEffect(() => {
        const fetchPreferences = async () => {
            try {
                // Fetch env info first
                const envRes = await fetch("/api/env");
                const envData = await envRes.json();
                const envLLM = envData.llm as LlmEnvInfo;
                setEnvInfo(envLLM);

                // Try to fetch user preferences from API
                const prefsRes = await fetch("/api/user-preferences");
                if (prefsRes.ok) {
                    const prefsData = await prefsRes.json();
                    if (prefsData.success && prefsData.preferences) {
                        const { selectedLlmProvider, selectedGraphId: prefGraphId } = prefsData.preferences;
                        if (selectedLlmProvider) {
                            setLlmProvider(selectedLlmProvider);
                        } else {
                            // Fallback to localStorage then env
                            const stored = window.localStorage.getItem("numezis-llm-selection");
                            if (stored) {
                                try {
                                    const parsed = JSON.parse(stored);
                                    if (parsed.provider) setLlmProvider(parsed.provider);
                                } catch { }
                            } else {
                                setLlmProvider(envLLM?.defaultProvider || 'azure');
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
                    setLlmProvider(envLLM?.defaultProvider || 'azure');
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
        // Save to localStorage as fallback
        window.localStorage.setItem(
            "numezis-llm-selection",
            JSON.stringify({ provider, model: provider === 'azure' ? envInfo?.azure?.model : envInfo?.lmstudio?.model })
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

    const llmOptions = useMemo(() => [
        { id: 'azure', label: 'Azure OpenAI', sub: envInfo?.azure?.model || 'Not configured' },
        { id: 'openai', label: 'OpenAI', sub: 'gpt-4o' },
        { id: 'claude', label: 'Claude', sub: 'claude-sonnet-4' },
        { id: 'gemini', label: 'Gemini', sub: 'gemini-2.5-flash' },
        { id: 'lmstudio', label: 'LM Studio', sub: envInfo?.lmstudio?.model || 'Not configured' },
        { id: 'ollama', label: 'Ollama', sub: 'qwen2.5:14b' },
    ].filter((option) => enabledProviders.includes(option.id as LlmProviderType)), [envInfo, enabledProviders]);

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
        envInfo,
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
