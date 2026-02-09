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
      const list = Array.isArray(data?.graphs) ? (data.graphs as AgentGraphSummary[]) : [];
      setGraphs(list);
      if (list.length > 0) {
        const nextSelected =
          selectedGraph && list.some((g) => g.id === selectedGraph) ? selectedGraph : list[0].id;
        setSelectedGraph(nextSelected);
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

  async function changeProvider(provider: string) {
    setSelectedProvider(provider);
    const providerData = providers.find((p) => p.id === provider);
    if (providerData?.models.length) {
      setSelectedModel(providerData.models[0].id);
    }
    // Update modelConfig so the chat request uses the new provider
    setModelConfig((prev) => (prev ? { ...prev, provider } : { provider }));
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
    setSelectedModel,
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
