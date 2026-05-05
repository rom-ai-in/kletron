import { useEffect, useState, useCallback } from "react";

type LlmSummary = { provider?: string } | null;

function formatProvider(provider: string | null | undefined): string | null {
  if (!provider) return null;
  const names: Record<string, string> = {
    azure: "Azure",
    openai: "OpenAI",
    claude: "Claude",
    gemini: "Gemini",
    lmstudio: "LM Studio",
    ollama: "Ollama",
    voyage: "Voyage",
  };
  return names[provider] || provider;
}

export type ConfigurationHubMeta = {
  graphsCount: number;
  toolsCount: number;
  aiModelsMeta: string;
  loading: boolean;
};

export function useConfigurationHubMeta(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  backendReady: boolean,
) {
  const [llmProvider, setLlmProvider] = useState<LlmSummary>(null);
  const [embeddingProvider, setEmbeddingProvider] = useState<string | null>(null);
  const [graphsCount, setGraphsCount] = useState(0);
  const [toolsCount, setToolsCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!backendReady) return;
    setLoading(true);
    try {
      const [llmRes, embRes, gRes, tRes] = await Promise.all([
        apiFetch("/api/llm-config"),
        apiFetch("/api/embedding-config"),
        apiFetch("/api/agent-graphs"),
        apiFetch("/api/tools/list"),
      ]);
      if (llmRes.ok) {
        try {
          const data = await llmRes.json();
          setLlmProvider({ provider: data.provider });
        } catch {
          setLlmProvider(null);
        }
      } else setLlmProvider(null);
      if (embRes.ok) {
        try {
          const data = await embRes.json();
          setEmbeddingProvider(typeof data.provider === "string" ? data.provider : null);
        } catch {
          setEmbeddingProvider(null);
        }
      } else setEmbeddingProvider(null);
      if (gRes.ok) {
        try {
          const data = await gRes.json();
          setGraphsCount(Array.isArray(data?.graphs) ? data.graphs.length : 0);
        } catch {
          setGraphsCount(0);
        }
      } else setGraphsCount(0);
      if (tRes.ok) {
        try {
          const data = await tRes.json();
          setToolsCount(Array.isArray(data) ? data.length : 0);
        } catch {
          setToolsCount(0);
        }
      } else setToolsCount(0);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, backendReady]);

  useEffect(() => {
    void load();
  }, [load]);

  const llm = formatProvider(llmProvider?.provider);
  const embedding = formatProvider(embeddingProvider);
  let aiModelsMeta = "Not configured";
  if (llm && embedding) aiModelsMeta = `LLM: ${llm} · Embed: ${embedding}`;
  else if (llm) aiModelsMeta = `LLM: ${llm}`;
  else if (embedding) aiModelsMeta = `Embed: ${embedding}`;

  return {
    graphsCount,
    toolsCount,
    aiModelsMeta,
    loading,
    refresh: load,
  };
}
