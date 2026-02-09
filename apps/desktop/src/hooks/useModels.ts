import { useEffect, useState } from "react";
import type { AgentGraphRunSummary, AgentGraphSummary, LlmConfig, LLMProvider, ToolMetadata } from "../types";
import { formatDateTime } from "../utils";

export function useModels(
  backendUrlTrimmed: string,
  backendReady: boolean,
  getAccessToken: () => Promise<string | null>
) {
  const [modelLabel, setModelLabel] = useState<string>("Backend");
  const [modelConfig, setModelConfig] = useState<LlmConfig | null>(null);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [graphs, setGraphs] = useState<AgentGraphSummary[]>([]);
  const [graphsLoading, setGraphsLoading] = useState(false);
  const [graphsError, setGraphsError] = useState<string | null>(null);
  const [selectedGraph, setSelectedGraph] = useState<string | null>(null);
  const [graphRuns, setGraphRuns] = useState<AgentGraphRunSummary[]>([]);
  const [graphRunsLoading, setGraphRunsLoading] = useState(false);
  const [graphRunsError, setGraphRunsError] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolMetadata[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);

  // LLM provider health status
  const [llmHealthy, setLlmHealthy] = useState<boolean | null>(null);
  const [llmHealthChecking, setLlmHealthChecking] = useState(false);

  async function loadModel() {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/llm-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const provider = data?.provider ?? "backend";
      const providerConfig = data?.[provider] ?? {};
      const model = providerConfig?.model || providerConfig?.deployment || "Default";
      setModelLabel(model || "Backend");
      setModelConfig(data ?? null);
      setSelectedProvider(provider);
      setSelectedModel(model);

      // Build providers list from config
      const knownProviders = ["openai", "claude", "azure", "gemini", "ollama", "lmstudio"];
      const providersList: LLMProvider[] = knownProviders
        .filter((p) => data?.[p])
        .map((p) => ({
          id: p,
          label: p === "openai" ? "OpenAI" : p === "claude" ? "Anthropic" : p === "azure" ? "Azure" : p === "gemini" ? "Google" : p === "ollama" ? "Ollama" : "LM Studio",
          models: data[p]?.model ? [{ id: data[p].model, label: data[p].model }] : [],
          connected: p === provider,
        }));
      setProviders(providersList);
    } catch {
      // ignore
    }
  }

  async function loadGraphs() {
    const token = await getAccessToken();
    if (!token) return;
    try {
      setGraphsLoading(true);
      setGraphsError(null);
      const res = await fetch(`${backendUrlTrimmed}/api/agent-graphs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load graphs (${res.status})`);
      }
      const data = await res.json();
      // API returns MongoDB docs with `_id`; normalise to `id` for the UI
      const raw = Array.isArray(data?.graphs) ? data.graphs : [];
      const list: AgentGraphSummary[] = raw
        .map((g: any) => ({
          id: String(g.id ?? g._id ?? ""),
          name: g.name,
          description: g.description,
          updatedAt: g.updatedAt,
        }))
        .filter((g) => g.id); // discard entries without a usable id
      setGraphs(list);
      if (list.length > 0) {
        // Use functional updater to avoid stale closure — never overwrite
        // a selection the user just made while this fetch was in flight.
        setSelectedGraph((prev) =>
          prev && list.some((g) => g.id === prev) ? prev : list[0].id
        );
      } else {
        setSelectedGraph(null);
      }
    } catch {
      setGraphsError("Unable to load graphs.");
    } finally {
      setGraphsLoading(false);
    }
  }

  async function loadGraphRuns(graphId: string) {
    const token = await getAccessToken();
    if (!token) return;
    setGraphRunsLoading(true);
    setGraphRunsError(null);
    try {
      const res = await fetch(
        `${backendUrlTrimmed}/api/agent-graph-runs?graphId=${encodeURIComponent(graphId)}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load runs (${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data?.runs) ? (data.runs as AgentGraphRunSummary[]) : [];
      setGraphRuns(list);
    } catch (error) {
      setGraphRunsError((error as Error)?.message || "Unable to load runs.");
      setGraphRuns([]);
    } finally {
      setGraphRunsLoading(false);
    }
  }

  async function startGraphRun(graphId: string) {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/agent-graphs/${graphId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to start run (${res.status})`);
      }
      await loadGraphRuns(graphId);
    } catch (error) {
      setGraphRunsError((error as Error)?.message || "Unable to start run.");
    }
  }

  async function loadTools() {
    const token = await getAccessToken();
    if (!token) return;
    setToolsLoading(true);
    setToolsError(null);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/tools/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load tools (${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? (data as ToolMetadata[]) : [];
      setTools(list);
    } catch (error) {
      setToolsError((error as Error)?.message || "Unable to load tools.");
      setTools([]);
    } finally {
      setToolsLoading(false);
    }
  }

  /** Check LLM provider health by calling POST /api/llm-config/test */
  async function checkLlmHealth(provider?: string, config?: Record<string, unknown>) {
    const token = await getAccessToken();
    if (!token) { setLlmHealthy(false); return; }

    const providerToTest = provider || selectedProvider;
    if (!providerToTest || !modelConfig) { setLlmHealthy(null); return; }

    // Build the config payload from what we know
    const providerConfig = config || (modelConfig as Record<string, unknown>)?.[providerToTest] || {};

    setLlmHealthChecking(true);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/llm-config/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider: providerToTest, config: providerConfig }),
        signal: AbortSignal.timeout(15000), // 15s timeout for health check
      });
      if (!res.ok) { setLlmHealthy(false); return; }
      const data = await res.json();
      setLlmHealthy(data.success === true);
    } catch {
      setLlmHealthy(false);
    } finally {
      setLlmHealthChecking(false);
    }
  }

  // Auto-check LLM health when provider/model changes
  useEffect(() => {
    if (backendReady && selectedProvider && modelConfig) {
      void checkLlmHealth();
    }
  }, [selectedProvider, selectedModel, backendReady]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Persist LLM config changes to backend via PUT /api/llm-config */
  async function saveModelConfig(provider: string, model: string) {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const body: Record<string, unknown> = { provider };
      // Set the provider-specific config
      body[provider] = { model };
      await fetch(`${backendUrlTrimmed}/api/llm-config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Silently fail — user can retry from settings
    }
  }

  async function changeProvider(provider: string) {
    setSelectedProvider(provider);
    const providerData = providers.find((p) => p.id === provider);
    const model = providerData?.models.length ? providerData.models[0].id : null;
    if (model) {
      setSelectedModel(model);
    }
    // Update modelConfig so the chat request uses the new provider
    setModelConfig((prev) => (prev ? { ...prev, provider } : { provider }));
    // Persist to backend
    if (model) void saveModelConfig(provider, model);
  }

  function changeModel(model: string) {
    setSelectedModel(model);
    // Persist to backend
    if (selectedProvider) void saveModelConfig(selectedProvider, model);
  }

  const modelMeta = modelConfig?.provider ? `${modelConfig.provider} · ${modelLabel}` : modelLabel;
  const selectedGraphName = graphs.find((g) => g.id === selectedGraph)?.name;

  return {
    modelLabel,
    modelConfig,
    modelMeta,
    providers,
    selectedProvider,
    selectedModel,
    changeProvider,
    changeModel,
    setSelectedModel,
    saveModelConfig,
    llmHealthy,
    llmHealthChecking,
    checkLlmHealth,
    graphs,
    graphsLoading,
    graphsError,
    selectedGraph,
    setSelectedGraph,
    selectedGraphName,
    graphRuns,
    graphRunsLoading,
    graphRunsError,
    tools,
    toolsLoading,
    toolsError,
    loadModel,
    loadGraphs,
    loadGraphRuns,
    startGraphRun,
    loadTools,
  };
}
