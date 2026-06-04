/**
 * Settings-focused LLM config, graph runs, and tools.
 * Agent composer graph + provider selection lives in `useAgentSession` (shared UI hook).
 */
import { useEffect, useState } from "react";
import { defaultAgentGraphPayload } from "@kletron/shared";
import type { AgentGraphRunSummary, LlmConfig, LLMProvider, ToolMetadata } from "../types";

export function useModels(
  backendUrlTrimmed: string,
  backendReady: boolean,
  getAccessToken: () => Promise<string | null>,
  activeWorkspaceId?: string | null
) {
  const [modelLabel, setModelLabel] = useState<string>("Backend");
  const [modelConfig, setModelConfig] = useState<LlmConfig | null>(null);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [graphRuns, setGraphRuns] = useState<AgentGraphRunSummary[]>([]);
  const [graphRunsLoading, setGraphRunsLoading] = useState(false);
  const [graphRunsError, setGraphRunsError] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolMetadata[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);

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

      const knownProviders = ["openai", "codex", "claude", "azure", "gemini", "vertex", "ollama", "lmstudio", "vllm"];
      const providerLabels: Record<string, string> = {
        openai: "OpenAI",
        codex: "Codex",
        claude: "Anthropic",
        azure: "Azure",
        gemini: "Google Gemini",
        vertex: "Vertex AI",
        ollama: "Ollama",
        lmstudio: "LM Studio",
        vllm: "vLLM",
      };
      const providersList: LLMProvider[] = knownProviders
        .filter((p) => data?.[p])
        .map((p) => ({
          id: p,
          label: providerLabels[p] ?? p,
          models: data[p]?.model ? [{ id: data[p].model, label: data[p].model }] : [],
          connected: p === provider,
        }));
      setProviders(providersList);
    } catch {
      // ignore
    }
  }

  async function loadGraphRuns(graphId: string) {
    const token = await getAccessToken();
    if (!token) return;
    setGraphRunsLoading(true);
    setGraphRunsError(null);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;
      const res = await fetch(
        `${backendUrlTrimmed}/api/agent-graph-runs?graphId=${encodeURIComponent(graphId)}&limit=20`,
        { headers }
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

  async function createAgentGraph(): Promise<string | null> {
    const token = await getAccessToken();
    if (!token) return null;
    try {
      const h: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (activeWorkspaceId) h["x-workspace-id"] = activeWorkspaceId;
      const res = await fetch(`${backendUrlTrimmed}/api/agent-graphs`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(defaultAgentGraphPayload()),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { graphId?: string };
      return typeof data.graphId === "string" ? data.graphId : null;
    } catch {
      return null;
    }
  }

  async function startGraphRun(graphId: string) {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const h: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (activeWorkspaceId) h["x-workspace-id"] = activeWorkspaceId;
      const res = await fetch(`${backendUrlTrimmed}/api/agent-graphs/${graphId}/runs`, {
        method: "POST",
        headers: h,
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

  async function checkLlmHealth(provider?: string, config?: Record<string, unknown>) {
    const token = await getAccessToken();
    if (!token) {
      setLlmHealthy(false);
      return;
    }

    const providerToTest = provider || selectedProvider;
    if (!providerToTest || !modelConfig) {
      setLlmHealthy(null);
      return;
    }

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
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        setLlmHealthy(false);
        return;
      }
      const data = await res.json();
      setLlmHealthy(data.success === true);
    } catch {
      setLlmHealthy(false);
    } finally {
      setLlmHealthChecking(false);
    }
  }

  useEffect(() => {
    if (backendReady && selectedProvider && modelConfig) {
      void checkLlmHealth();
    }
  }, [selectedProvider, selectedModel, backendReady]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveModelConfig(provider: string, model: string) {
    const token = await getAccessToken();
    if (!token) return;
    try {
      await fetch(`${backendUrlTrimmed}/api/llm-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider }),
      });
      const existingProviderConfig = (modelConfig as Record<string, unknown>)?.[provider] ?? {};
      const mergedConfig = { ...existingProviderConfig, model };
      await fetch(`${backendUrlTrimmed}/api/llm-config/${provider}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(mergedConfig),
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
    setModelConfig((prev) => (prev ? { ...prev, provider } : { provider }));
    if (model) void saveModelConfig(provider, model);
  }

  function changeModel(model: string) {
    setSelectedModel(model);
    if (selectedProvider) void saveModelConfig(selectedProvider, model);
  }

  const modelMeta = modelConfig?.provider ? `${modelConfig.provider} · ${modelLabel}` : modelLabel;

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
    graphRuns,
    graphRunsLoading,
    graphRunsError,
    tools,
    toolsLoading,
    toolsError,
    loadModel,
    loadGraphRuns,
    startGraphRun,
    createAgentGraph,
    loadTools,
  };
}
