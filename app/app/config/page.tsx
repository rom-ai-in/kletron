"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Settings, Sparkles, ListTree, ArrowRight, Wrench, Folder, Database } from "lucide-react";

import { Panel } from "@/src/components/ui/Panel";

type LlmConfigSummary = { provider?: "azure" | "lmstudio" } | null;

export default function ConfigOverviewPage() {
  const [graphsCount, setGraphsCount] = useState<number>(0);
  const [toolsCount, setToolsCount] = useState<number>(0);
  const [contextEnabled, setContextEnabled] = useState<boolean | null>(null);
  const [llmProvider, setLlmProvider] = useState<LlmConfigSummary>(null);
  const [embeddingProvider, setEmbeddingProvider] = useState<string | null>(null);

  useEffect(() => {
    // Context (local)
    try {
      const raw = window.localStorage.getItem("numezis-audit-context");
      if (!raw) {
        setContextEnabled(null);
      } else {
        const parsed = JSON.parse(raw);
        setContextEnabled(typeof parsed.enabled === "boolean" ? parsed.enabled : null);
      }
    } catch {
      setContextEnabled(null);
    }

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

  return (
    <div className="flex h-full flex-col bg-bg-app overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Configuration</h1>
          <p className="text-sm text-text-muted">One place to manage Context, LLM providers, and Graph flows.</p>
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
            title="Context"
            description="Global context injected into agent runs."
            icon={<Settings className="h-4 w-4 text-text-muted" />}
            href="/app/config/context"
            meta={
              contextEnabled === null ? "Not set" : contextEnabled ? "Enabled" : "Disabled"
            }
          />
          <ConfigCard
            title="LLM"
            description="Providers, connection settings, and defaults."
            icon={<Sparkles className="h-4 w-4 text-text-muted" />}
            href="/app/config/llm"
            meta={
              llmProvider?.provider
                ? `Active: ${llmProvider.provider === "azure" ? "Azure OpenAI" : "LM Studio"}`
                : "Unknown"
            }
          />
          <ConfigCard
            title="Embeddings"
            description="Vector model configuration."
            icon={<Database className="h-4 w-4 text-text-muted" />}
            href="/app/config/embeddings"
            meta={
              embeddingProvider
                ? `Active: ${embeddingProvider === "azure" ? "Azure OpenAI" : "LM Studio"}`
                : "Unknown"
            }
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
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  meta: string;
}) {
  return (
    <Link href={href} className="group">
      <Panel className="p-4 h-full transition-colors group-hover:border-border-strong">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {icon}
              <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
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
