"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ListTree, ArrowRight, Wrench, Folder, Brain, Layers, TrendingUp } from "lucide-react";
import { Panel } from "@kletron/ui/components/design-system";

type LlmConfigSummary = { provider?: string } | null;

export default function ConfigOverviewPage() {
  const [graphsCount, setGraphsCount] = useState<number>(0);
  const [toolsCount, setToolsCount] = useState<number>(0);
  const [llmProvider, setLlmProvider] = useState<LlmConfigSummary>(null);
  const [embeddingProvider, setEmbeddingProvider] = useState<string | null>(null);
  const [baPersonasCount, setBaPersonasCount] = useState<number>(0);
  const [baCompetitorsCount, setBaCompetitorsCount] = useState<number>(0);
  const [baHasVision, setBaHasVision] = useState(false);

  useEffect(() => {
    // LLM provider (server)
    const fetchProvider = async () => {
      try {
        const res = await fetch("/api/llm-config");
        if (!res.ok) throw new Error("Failed to fetch llm config");
        const data = await res.json();
        setLlmProvider({ provider: data.provider });
      } catch {
        setLlmProvider(null);
      }
    };

    // Embedding provider (server)
    const fetchEmbedding = async () => {
      try {
        const res = await fetch("/api/embedding-config");
        if (!res.ok) throw new Error("Failed to fetch embedding config");
        const data = await res.json();
        setEmbeddingProvider(data.provider);
      } catch {
        setEmbeddingProvider(null);
      }
    };

    void fetchProvider();
    void fetchEmbedding();
  }, []);

  useEffect(() => {
    const fetchGraphs = async () => {
      try {
        const res = await fetch("/api/agent-graphs");
        if (!res.ok) return;
        const data = await res.json();
        setGraphsCount(Array.isArray(data?.graphs) ? data.graphs.length : 0);
      } catch {
        setGraphsCount(0);
      }
    };
    void fetchGraphs();
  }, []);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const res = await fetch("/api/tools/list");
        if (!res.ok) return;
        const data = await res.json();
        setToolsCount(Array.isArray(data) ? data.length : 0);
      } catch {
        setToolsCount(0);
      }
    };
    void fetchTools();
  }, []);

  useEffect(() => {
    const fetchBAContext = async () => {
      try {
        const res = await fetch("/api/business-analyst/context");
        if (!res.ok) return;
        const data = await res.json();
        const ctx = data.context;
        if (ctx) {
          setBaPersonasCount(Array.isArray(ctx.personas) ? ctx.personas.length : 0);
          setBaCompetitorsCount(Array.isArray(ctx.competitors) ? ctx.competitors.length : 0);
          setBaHasVision(!!ctx.productVision);
        }
      } catch {
        // Silently fail — card will show "Not configured"
      }
    };
    void fetchBAContext();
  }, []);

  // Format provider names for display
  const formatProvider = (provider: string | null | undefined) => {
    if (!provider) return null;
    const providerNames: Record<string, string> = {
      azure: "Azure",
      openai: "OpenAI",
      claude: "Claude",
      gemini: "Gemini",
      lmstudio: "LM Studio",
      ollama: "Ollama",
      voyage: "Voyage",
    };
    return providerNames[provider] || provider;
  };

  // Build BA meta string
  const getBaMeta = () => {
    const parts: string[] = [];
    if (baHasVision) parts.push("Vision set");
    if (baPersonasCount > 0) parts.push(`${baPersonasCount} persona${baPersonasCount > 1 ? "s" : ""}`);
    if (baCompetitorsCount > 0) parts.push(`${baCompetitorsCount} competitor${baCompetitorsCount > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(" · ") : "Not configured yet";
  };

  // Build AI Models meta string
  const getAiModelsMeta = () => {
    const llm = formatProvider(llmProvider?.provider);
    const embedding = formatProvider(embeddingProvider);

    if (llm && embedding) {
      return `LLM: ${llm} · Embed: ${embedding}`;
    } else if (llm) {
      return `LLM: ${llm}`;
    } else if (embedding) {
      return `Embed: ${embedding}`;
    }
    return "Not configured";
  };

  return (
    <div className="flex h-full flex-col bg-bg-app overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Configuration</h1>
          <p className="text-sm text-text-muted">One place to manage AI providers and Graph flows.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ConfigCard
            title="Workspace"
            description="Manage MCP repository root."
            icon={<Folder className="h-4 w-4 text-text-muted" />}
            href="/app/config/workspace"
            meta="Repository Settings"
          />
          <ConfigCard
            title="AI Models"
            description="LLM providers & embedding models."
            icon={<Brain className="h-4 w-4 text-status-success-text" />}
            href="/app/config/llm"
            meta={getAiModelsMeta()}
            highlight
          />
          <ConfigCard
            title="Context"
            description="Project soul, cache, and graph debugging."
            icon={<Layers className="h-4 w-4 text-text-muted" />}
            href="/app/config/context"
            meta="Audit context & knowledge graph"
          />
          <ConfigCard
            title="Graphs"
            description="DB-backed agent graphs (nodes + edges)."
            icon={<ListTree className="h-4 w-4 text-text-muted" />}
            href="/app/config/graphs"
            meta={`${graphsCount} graphs`}
          />
          <ConfigCard
            title="Tools"
            description="Available tools for agents."
            icon={<Wrench className="h-4 w-4 text-text-muted" />}
            href="/app/config/tools"
            meta={`${toolsCount} tools available`}
          />
          <ConfigCard
            title="Business Analyst"
            description="Product vision, user personas & competitors."
            icon={<TrendingUp className="h-4 w-4 text-text-muted" />}
            href="/app/business-analyst/config"
            meta={getBaMeta()}
          />
        </div>

        <div className="mt-6">
          <Panel className="p-4">
            <p className="text-xs text-text-secondary">
              Tip: each section is deep-linkable. You can share links like <span className="font-mono">/config/graphs</span>{" "}
              with your team.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ConfigCard({
  title,
  description,
  icon,
  href,
  meta,
  highlight = false,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  meta: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className="group">
      <Panel className={`p-4 h-full transition-colors group-hover:border-border-strong ${highlight ? "border-status-success-border" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {icon}
              <h2 className={`text-sm font-semibold ${highlight ? "text-status-success-text" : "text-text-primary"}`}>{title}</h2>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{description}</p>
            <p className="mt-3 text-[11px] text-text-muted">{meta}</p>
          </div>
          <div className="mt-0.5 text-text-muted group-hover:text-text-primary transition-colors">
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </Panel>
    </Link>
  );
}
