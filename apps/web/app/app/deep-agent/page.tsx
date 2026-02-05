"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

import type { McpToolMeta } from "@numezis/agent-core/tools/mcpToolMetadata";
import type {
  AgentEvent,
  AgentWorkflowResult,
  AgentWorkflowUpdate,
  TimelineEvent,
} from "@numezis/shared/types";
import { graphOptions } from "@numezis/shared/graphCatalog";
import type { GraphId } from "@numezis/shared/graphCatalog";
import { Selector } from "@numezis/ui/components/design-system";
import {
  DurationDisplay,
  TokenUsageDisplay,
  formatDuration,
  formatTokenCount,
  type TokenUsageSummary,
} from "@numezis/ui/components/Agent/metrics";
import {
  formatAuditContextSummary,
  normalizeAuditContext,
  type AuditContext,
} from "@numezis/shared/auditContext";
import { AzureConfigForm, LMStudioConfigForm } from "@numezis/ui/components/LlmConfigForms";
import { Loader2 } from "lucide-react";
import { useLlmHealth } from "@numezis/ui/hooks/useLlmHealth";
import type { LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";

type AgentEventKind = AgentEvent["kind"];

const createSystemEvent = (): AgentEvent => ({
  id: `system-${Date.now()}`,
  phaseId: "user",
  phaseLabel: "Cursor system",
  kind: "system",
  role: "system",
  content: "Cursor-mode ready. Ask anything and watch the phases execute.",
  timestamp: new Date().toISOString(),
});

const eventBadgeStyles: Record<AgentEventKind, string> = {
  system: "border-border-subtle bg-bg-elevated text-text-muted",
  user: "border-border-strong bg-bg-surface text-text-primary",
  assistant: "border-border-subtle bg-bg-surface text-text-secondary",
  tool: "border-border-subtle bg-bg-elevated text-text-muted font-mono",
};

const eventBadgeLabel: Record<AgentEventKind, string> = {
  system: "System",
  user: "User",
  assistant: "Agent",
  tool: "Tool",
};

const startupPhaseOptions = [
  "Discovery / Prototype",
  "MVP build",
  "MVP launch",
  "Early traction",
  "Scale-up",
];

const mvpLaunchPreset: AuditContext = {
  startupPhase: "MVP launch",
  mission: "Launch a viable product as soon as possible.",
  primaryGoal: "Ship core user flows quickly with minimal blockers.",
  keyObjectives: [
    "Unblock critical user journeys",
    "Stabilize build/deploy and core APIs",
    "Reduce reliability bugs that block launch",
  ],
  nonGoals: [
    "Scalability optimizations beyond launch needs",
    "Large refactors or architecture rewrites",
    "Performance tuning without user-visible impact",
  ],
  timeHorizon: "Next 4-6 weeks",
  riskTolerance: "medium",
};
const SESSION_STORAGE_KEY = "deep-agent-active-run";

type StreamChunk =
  | { type: "init"; payload: { runId: string; graphId: string } }
  | { type: "update"; payload: AgentWorkflowUpdate }
  | { type: "final"; payload: AgentWorkflowResult }
  | { type: "error"; payload: { message: string } };

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

const formatTimestamp = (value?: string) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
};

const formatJsonString = (value?: string) => {
  if (!value) return "";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};

const parseMultilineList = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);

import { Modal } from "@numezis/ui/components/design-system";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Token usage summary for display */
type TokenUsageForDisplay = TokenUsageSummary;

type TimelinePanelProps = {
  timeline: TimelineEvent[];
  selectedEventId: string | null;
  onPhaseSelect: (eventId: string) => void;
  className?: string;
  tokenUsage?: TokenUsageForDisplay;
};

type AgentGraphRecord = {
  _id?: string;
  name: string;
  description?: string;
  nodes?: Array<{ id: string; label: string; react?: { systemPrompt?: string; toolNames?: string[] }; output?: { schemaId?: string } }>;
  edges?: Array<{ id: string; source: string; target: string }>;
};

function TimelinePanel({ timeline, selectedEventId, onPhaseSelect, className, tokenUsage }: TimelinePanelProps) {
  // Calculate total graph duration
  const graphDuration = useMemo(() => {
    const startedEvents = timeline.filter((e) => e.startedAt);
    if (!startedEvents.length) return null;
    const firstStart = startedEvents.reduce((min, e) => {
      const t = new Date(e.startedAt!).getTime();
      return t < min ? t : min;
    }, Infinity);
    const anyRunning = timeline.some((e) => e.status === "running");
    if (anyRunning) return { startedAt: new Date(firstStart).toISOString(), endedAt: undefined };
    const endedEvents = timeline.filter((e) => e.endedAt);
    if (!endedEvents.length) return { startedAt: new Date(firstStart).toISOString(), endedAt: undefined };
    const lastEnd = endedEvents.reduce((max, e) => {
      const t = new Date(e.endedAt!).getTime();
      return t > max ? t : max;
    }, 0);
    return { startedAt: new Date(firstStart).toISOString(), endedAt: new Date(lastEnd).toISOString() };
  }, [timeline]);

  return (
    <section className={`flex flex-col h-full bg-bg-surface border-b border-border-subtle overflow-hidden ${className}`}>
      <div className="flex-none border-b border-border-subtle px-3 py-2 bg-bg-surface">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Phases</h2>
          {graphDuration?.startedAt && (
            <div className="flex items-center gap-3">
              <TokenUsageDisplay tokenUsage={tokenUsage} />
              <DurationDisplay startedAt={graphDuration.startedAt} endedAt={graphDuration.endedAt} />
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-0 scrollbar-elegant">
        {timeline.map((event) => (
          <PhaseItem
            key={event.id}
            event={event}
            isSelected={selectedEventId === event.id}
            onSelect={() => onPhaseSelect(event.id)}
          />
        ))}
      </div>
    </section>
  );
}

/** Individual phase item with live timer for running phases */
function PhaseItem({
  event,
  isSelected,
  onSelect,
}: {
  event: TimelineEvent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [elapsed, setElapsed] = useState(() =>
    event.startedAt ? formatDuration(event.startedAt, event.endedAt) : ""
  );

  useEffect(() => {
    if (!event.startedAt) {
      setElapsed("");
      return;
    }
    if (event.endedAt || event.status !== "running") {
      setElapsed(formatDuration(event.startedAt, event.endedAt));
      return;
    }
    // Live update for running phases
    setElapsed(formatDuration(event.startedAt));
    const interval = setInterval(() => {
      setElapsed(formatDuration(event.startedAt));
    }, 500);
    return () => clearInterval(interval);
  }, [event.startedAt, event.endedAt, event.status]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-3 py-2.5 text-left transition-colors border-b border-border-subtle last:border-0 group ${isSelected
        ? "bg-state-selected"
        : "bg-transparent hover:bg-state-hover"
        }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-[12px] font-medium leading-tight ${isSelected ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"}`}>
          {event.label}
        </span>
        <div className="flex items-center gap-1.5">
          {event.tokenUsage && event.tokenUsage.totalTokens > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-emerald-400" title={`${event.tokenUsage.inputTokens} in + ${event.tokenUsage.outputTokens} out`}>
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTokenCount(event.tokenUsage.totalTokens)}
            </span>
          )}
          {elapsed && (
            <span className={`text-[10px] font-mono ${event.status === "running" ? "text-amber-400" : event.status === "success" ? "text-emerald-400" : event.status === "error" ? "text-rose-400" : "text-text-muted"}`}>
              {elapsed}
            </span>
          )}
          {event.status !== "pending" && (
            <div className={`h-1.5 w-1.5 rounded-full ${event.status === "success"
              ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.4)]"
              : event.status === "error"
                ? "bg-rose-400"
                : "bg-amber-400 animate-pulse"
              }`} />
          )}
        </div>
      </div>

      {event.summary && (
        <p className="text-[11px] text-text-muted truncate leading-relaxed opacity-80 mt-0.5">
          {event.summary}
        </p>
      )}

      {event.status === "running" && (
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-bg-elevated/50">
          <div className="h-full w-full bg-emerald-500/50 animate-progress-loader origin-left" />
        </div>
      )}
    </button>
  );
}


type ToolExplorerPanelProps = {
  tools: McpToolMeta[];
  usedToolNames: Set<string>;
  openToolDialog: (toolName: McpToolMeta) => void;
  className?: string;
};

function ToolExplorerPanel({ tools, usedToolNames, openToolDialog, className }: ToolExplorerPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTools = useMemo(() => {
    return tools
      .filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase()) || t.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tools, searchQuery]);

  return (
    <section className={`flex flex-col h-full bg-bg-surface overflow-hidden ${className}`}>
      <div className="flex-none flex flex-col border-b border-border-subtle bg-bg-surface">
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Tools</h3>
          <span className="text-[10px] text-text-muted">
            {usedToolNames.size} used
          </span>
        </div>
        <div className="px-3 pb-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded bg-bg-elevated border border-border-subtle px-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1.5 text-text-muted hover:text-text-primary"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-elegant p-0">
        <ul className="divide-y divide-border-subtle">
          {filteredTools.map((tool) => (
            <li key={tool.name}>
              <button
                type="button"
                onClick={() => openToolDialog(tool)}
                className="group flex w-full items-center justify-between px-3 py-2 text-left text-[12px] text-text-secondary transition hover:bg-state-hover hover:text-text-primary"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-1 h-1 rounded-full ${usedToolNames.has(tool.name) ? 'bg-emerald-400' : 'bg-transparent'}`}></div>
                  <span className="truncate">{tool.label}</span>
                </div>
                {usedToolNames.has(tool.name) && (
                  <span className="text-[10px] text-emerald-400 font-medium opacity-80">Used</span>
                )}
              </button>
            </li>
          ))}
          {filteredTools.length === 0 && (
            <li className="px-3 py-4 text-center text-[11px] text-text-muted italic">
              No tools found
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

type GraphOption = (typeof graphOptions)[number];

type HeaderControlsProps = {
  selectedGraphKey: string;
  selectedGraphLabel: string;
  selectedGraph: GraphOption;
  agentGraphs: AgentGraphRecord[];
  onSelectGraphKey: (graphKey: string) => void;
  modelProvider: LlmProviderType;
  onSelectProvider: (provider: LlmProviderType) => void;
  azureConfigured: boolean;
  llmInfo: LlmEnvInfo | null;
  lmStudioBaseUrl: string;
  lmStudioModel: string;
  onLmStudioModelChange: (value: string) => void;
  llmError: string | null;
  auditContextEnabled: boolean;
  onAuditContextEnabledChange: (enabled: boolean) => void;
  auditContextSummary: string | null;
  onConfigureAuditContext: () => void;
  isGraphInfoOpen: boolean;
  onSetGraphInfoOpen: (open: boolean) => void;
  isLlmInfoOpen: boolean;
  onSetLlmInfoOpen: (open: boolean) => void;
  detailGraph: GraphOption | null;
  onSetDetailGraph: (graph: GraphOption | null) => void;
  detailProvider: LlmProviderType | null;
  onSetDetailProvider: (provider: LlmProviderType | null) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
};

function HeaderControls({
  selectedGraphKey,
  selectedGraphLabel,
  selectedGraph,
  agentGraphs,
  onSelectGraphKey,
  modelProvider,
  onSelectProvider,
  azureConfigured,
  llmInfo,
  lmStudioBaseUrl,
  lmStudioModel,
  onLmStudioModelChange,
  llmError,
  auditContextEnabled,
  onAuditContextEnabledChange,
  auditContextSummary,
  onConfigureAuditContext,
  isGraphInfoOpen,
  onSetGraphInfoOpen,
  isLlmInfoOpen,
  onSetLlmInfoOpen,
  detailGraph,
  onSetDetailGraph,
  detailProvider,
  onSetDetailProvider,
  isSidebarOpen,
  onToggleSidebar,
}: HeaderControlsProps) {
  const [isGraphMenuOpen, setIsGraphMenuOpen] = useState(false);
  const [isLlmMenuOpen, setIsLlmMenuOpen] = useState(false);
  const graphMenuRef = useRef<HTMLDivElement | null>(null);
  const llmMenuRef = useRef<HTMLDivElement | null>(null);
  const graphDetail = detailGraph ?? selectedGraph;
  const llmDetail = detailProvider ?? modelProvider;
  const [isEditingLlm, setIsEditingLlm] = useState(false);
  const [llmConfigFromDb, setLlmConfigFromDb] = useState<any>(null);
  const [isTesting, setIsTesting] = useState<"azure" | "lmstudio" | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);

  const handleTestConnection = async (provider: "azure" | "lmstudio") => {
    setIsTesting(provider);
    setTestResult(null);
    try {
      // Use config from DB/env if available
      const configToTest = provider === 'azure'
        ? (llmConfigFromDb?.azure ?? llmInfo?.azure)
        : (llmConfigFromDb?.lmstudio ?? llmInfo?.lmstudio ?? { baseUrl: lmStudioBaseUrl, model: lmStudioModel });

      if (!configToTest) throw new Error("No configuration found");

      const res = await fetch("/api/llm-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          config: configToTest,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection refused");

      setTestResult({ success: true, message: `Success! Latency: ${data.latency}ms`, latency: data.latency });
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsTesting(null);
    }
  };

  // Fetch LLM config from database on mount
  const fetchLlmConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/llm-config');
      if (response.ok) {
        const data = await response.json();
        setLlmConfigFromDb(data);
      }
    } catch (error) {
      console.error('Failed to fetch LLM config:', error);
    }
  }, []);

  useEffect(() => {
    void fetchLlmConfig();
  }, [fetchLlmConfig]);

  // Save handlers
  const handleSaveAzure = useCallback(async (config: {
    endpoint: string;
    deployment: string;
    model: string;
    apiVersion: string;
    apiKey: string;
  }) => {
    const response = await fetch('/api/llm-config/azure', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (response.ok) {
      await fetchLlmConfig();
      setIsEditingLlm(false);
    } else {
      const error = await response.json();
      let errorMessage = error.error || 'Failed to save configuration';
      if (error.details && Array.isArray(error.details)) {
        const details = error.details
          .map((d: any) => `${d.path.join('.')}: ${d.message}`)
          .join(', ');
        errorMessage += ` (${details})`;
      }
      throw new Error(errorMessage);
    }
  }, [fetchLlmConfig]);

  const handleSaveLMStudio = useCallback(async (config: {
    baseUrl: string;
    model: string;
    apiKey?: string;
    modelSettings?: Record<string, unknown>;
  }) => {
    const response = await fetch('/api/llm-config/lmstudio', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (response.ok) {
      await fetchLlmConfig();
      setIsEditingLlm(false);
    } else {
      const error = await response.json();
      let errorMessage = error.error || 'Failed to save configuration';
      if (error.details && Array.isArray(error.details)) {
        const details = error.details
          .map((d: any) => `${d.path.join('.')}: ${d.message}`)
          .join(', ');
        errorMessage += ` (${details})`;
      }
      throw new Error(errorMessage);
    }
  }, [fetchLlmConfig]);

  const handleResetConfig = useCallback(async () => {
    if (!confirm('Reset to environment variable configuration? This will delete the database configuration.')) {
      return;
    }

    try {
      const response = await fetch('/api/llm-config', {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchLlmConfig();
        setIsEditingLlm(false);
      }
    } catch (error) {
      console.error('Failed to reset configuration:', error);
    }
  }, [fetchLlmConfig]);

  useEffect(() => {
    if (!isGraphMenuOpen && !isLlmMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (graphMenuRef.current && !graphMenuRef.current.contains(target)) {
        setIsGraphMenuOpen(false);
      }
      if (llmMenuRef.current && !llmMenuRef.current.contains(target)) {
        setIsLlmMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isGraphMenuOpen, isLlmMenuOpen]);

  return (
    <>




      <Modal
        open={isGraphInfoOpen}
        onClose={() => {
          onSetGraphInfoOpen(false);
          onSetDetailGraph(null);
        }}
        title="Graph details"
        subtitle={(detailGraph ?? selectedGraph).name}
      >
        <div className="space-y-4 text-sm text-text-secondary">
          <p>{graphDetail.description}</p>
          <div className="space-y-2">
            <p className="text-[11px] text-text-muted">Phases</p>
            <ul className="space-y-2">
              {graphDetail.phases.map((phase) => (
                <li key={phase.id} className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-[12px]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-text-primary">{phase.label}</p>
                    <span className="text-[10px] text-text-muted">
                      {phase.toolNames.length} {phase.toolNames.length === 1 ? 'tool' : 'tools'}
                    </span>
                  </div>
                  <p className="text-text-muted mb-2">{phase.summary}</p>
                  {phase.toolNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {phase.toolNames.map(tool => (
                        <span key={tool} className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px] font-mono text-text-muted">
                          {tool}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] italic text-text-muted italic">No tools available</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>

      <Modal
        open={isLlmInfoOpen}
        onClose={() => {
          onSetLlmInfoOpen(false);
          onSetDetailProvider(null);
          setIsEditingLlm(false);
          setTestResult(null);
        }}
        title="LLM details"
        subtitle={llmDetail === "azure" ? "Azure OpenAI" : "LM Studio (local)"}
      >
        {!isEditingLlm ? (
          // Read-only view
          llmDetail === "azure" ? (
            <div className="space-y-4 text-sm text-text-secondary">
              <div className="rounded-lg border border-border-subtle bg-bg-surface p-3">
                <p className="text-[11px] text-text-muted">Azure OpenAI</p>
                <p className="mt-2 text-text-primary">{azureConfigured ? "Configured" : "Missing credentials"}</p>
                <p className="mt-1 text-xs text-text-muted">Endpoint: {llmConfigFromDb?.azure?.endpoint ?? llmInfo?.azure?.endpoint ?? "Not set"}</p>
                <p className="mt-1 text-xs text-text-muted">Deployment: {llmConfigFromDb?.azure?.deployment ?? llmInfo?.azure?.deployment ?? "Not set"}</p>
                <p className="mt-1 text-xs text-text-muted">Model: {llmConfigFromDb?.azure?.model ?? llmInfo?.azure?.model ?? "Not set"}</p>
                <p className="mt-1 text-xs text-text-muted">API version: {llmConfigFromDb?.azure?.apiVersion ?? llmInfo?.azure?.apiVersion ?? "Not set"}</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xs text-text-muted">API Key: <span className="font-mono">••••••••</span></p>
                </div>
              </div>
              {llmError && <p className="text-xs text-rose-400">{llmError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsEditingLlm(true)}
                  className="px-4 py-2 rounded-md bg-bg-surface border border-border-strong text-text-primary hover:bg-state-hover transition text-xs font-medium"
                >
                  Edit Configuration
                </button>
                <button
                  onClick={() => void handleResetConfig()}
                  className="px-4 py-2 rounded-md bg-bg-surface border border-border-subtle text-text-secondary hover:bg-state-hover transition text-xs font-medium"
                >
                  Reset to Environment
                </button>
                <button
                  onClick={() => void handleTestConnection('azure')}
                  className="px-4 py-2 rounded-md bg-bg-surface border border-border-subtle text-text-primary hover:bg-state-hover transition text-xs font-medium flex items-center gap-2"
                >
                  {isTesting === 'azure' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Test Connection
                </button>
              </div>
              {testResult && (
                <div className={`mt-3 rounded-md border p-3 text-xs ${testResult.success ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-rose-500/20 bg-rose-500/5 text-rose-400'}`}>
                  <p className="font-semibold flex items-center gap-2">
                    {testResult.success ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {testResult.success ? "Connection Verified" : "Connection Failed"}
                  </p>
                  <p className="mt-1 ml-5 opacity-90">{testResult.message}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-sm text-text-secondary">
              <div className="rounded-lg border border-border-subtle bg-bg-surface p-3">
                <p className="text-[11px] text-text-muted">LM Studio</p>
                <p className="mt-2 text-text-primary">Base URL: {llmConfigFromDb?.lmstudio?.baseUrl ?? lmStudioBaseUrl}</p>
                <label className="mt-3 block text-[11px] text-text-muted">Model ID</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong"
                  placeholder="LM Studio model ID"
                  value={lmStudioModel}
                  onChange={(event) => onLmStudioModelChange(event.target.value)}
                />
              </div>
              {llmError && <p className="text-xs text-rose-400">{llmError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsEditingLlm(true)}
                  className="px-4 py-2 rounded-md bg-bg-surface border border-border-strong text-text-primary hover:bg-state-hover transition text-xs font-medium"
                >
                  Edit Configuration
                </button>
                <button
                  onClick={() => void handleResetConfig()}
                  className="px-4 py-2 rounded-md bg-bg-surface border border-border-subtle text-text-secondary hover:bg-state-hover transition text-xs font-medium"
                >
                  Reset to Environment
                </button>
                <button
                  onClick={() => void handleTestConnection('lmstudio')}
                  className="px-4 py-2 rounded-md bg-bg-surface border border-border-subtle text-text-primary hover:bg-state-hover transition text-xs font-medium flex items-center gap-2"
                >
                  {isTesting === 'lmstudio' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Test Connection
                </button>
              </div>
              {testResult && (
                <div className={`mt-3 rounded-md border p-3 text-xs ${testResult.success ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-rose-500/20 bg-rose-500/5 text-rose-400'}`}>
                  <p className="font-semibold flex items-center gap-2">
                    {testResult.success ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {testResult.success ? "Connection Verified" : "Connection Failed"}
                  </p>
                  <p className="mt-1 ml-5 opacity-90">{testResult.message}</p>
                </div>
              )}
            </div>
          )) : (
          // Edit mode
          llmDetail === "azure" ? (
            <AzureConfigForm
              initialConfig={{
                endpoint: llmConfigFromDb?.azure?.endpoint ?? llmInfo?.azure?.endpoint ?? "",
                deployment: llmConfigFromDb?.azure?.deployment ?? llmInfo?.azure?.deployment ?? "",
                model: llmConfigFromDb?.azure?.model ?? llmInfo?.azure?.model ?? "",
                apiVersion: llmConfigFromDb?.azure?.apiVersion ?? llmInfo?.azure?.apiVersion ?? "",
                apiKey: llmConfigFromDb?.azure?.apiKey ?? (llmInfo?.azure?.configured ? "••••••••" : ""),
              }}
              onSave={handleSaveAzure}
              onCancel={() => setIsEditingLlm(false)}
            />
          ) : (
            <LMStudioConfigForm
              initialConfig={{
                baseUrl: llmConfigFromDb?.lmstudio?.baseUrl ?? lmStudioBaseUrl,
                model: llmConfigFromDb?.lmstudio?.model ?? lmStudioModel,
                apiKey: llmConfigFromDb?.lmstudio?.apiKey ?? (llmInfo?.lmstudio?.configured ? "lm-studio" : ""),
                modelSettings: llmConfigFromDb?.lmstudio?.modelSettings,
              }}
              onSave={handleSaveLMStudio}
              onCancel={() => setIsEditingLlm(false)}
            />
          )
        )
        }
      </Modal >
    </>
  );
}
type EventCardProps = {
  event: AgentEvent;
  toolMeta?: McpToolMeta;
  openToolDialog: (tool: McpToolMeta) => void;
};

function EventCard({ event, toolMeta, openToolDialog }: EventCardProps) {
  const isToolEvent = event.kind === "tool";
  const formattedArgs = formatJsonString(event.toolArgs);
  const resultTextRaw = event.content?.trim() ?? "";
  const resultText = resultTextRaw || (isToolEvent ? "" : "No response yet.");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const titleText = isToolEvent
    ? toolMeta?.label ?? event.name ?? "Tool output"
    : event.kind === "user"
      ? "User request"
      : event.kind === "assistant"
        ? "Agent response"
        : "System message";
  const agentMarkdown = (() => {
    if (event.kind !== "assistant") return null;
    try {
      const parsed = JSON.parse(resultText);
      if (typeof parsed?.report_markdown === "string") return parsed.report_markdown;
      if (typeof parsed?.repo_map_markdown === "string") return parsed.repo_map_markdown;
    } catch { }
    return null;
  })();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [copyResponseStatus, setCopyResponseStatus] = useState<"idle" | "copied" | "error">("idle");
  const handleCopyMarkdown = useCallback(() => {
    if (!agentMarkdown) return;
    navigator.clipboard
      ?.writeText(agentMarkdown)
      .then(() => {
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 1500);
      })
      .catch(() => {
        setCopyStatus("error");
        setTimeout(() => setCopyStatus("idle"), 1500);
      });
  }, [agentMarkdown]);
  const handleCopyResponse = useCallback(() => {
    if (!resultText) return;
    navigator.clipboard
      ?.writeText(resultText)
      .then(() => {
        setCopyResponseStatus("copied");
        setTimeout(() => setCopyResponseStatus("idle"), 1500);
      })
      .catch(() => {
        setCopyResponseStatus("error");
        setTimeout(() => setCopyResponseStatus("idle"), 1500);
      });
  }, [resultText]);
  const firstMeaningfulLine = (() => {
    const lines = resultText.split(/\r?\n/);
    const generalSkips = [
      /^[\{\[\]\}]+$/,
      /^[\{\[\]\}]+;?$/,
      /^\/\*/,
      /^\*+\//,
      /^\/\/+/,
      /^#!\//,
    ];
    const toolSkips = [/^["'][\w-]+["']\s*:/];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (generalSkips.some((regex) => regex.test(trimmed))) continue;
      if (isToolEvent && toolSkips.some((regex) => regex.test(trimmed))) continue;
      return trimmed;
    }
    return lines[0] ?? resultText;
  })();
  const argsPreview = (() => {
    if (!formattedArgs) return "";
    const lines = formattedArgs.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^[\{\[\]\}]+,?$/.test(trimmed)) continue;
      return trimmed;
    }
    return formattedArgs.slice(0, 200);
  })();
  const collapsedPreview =
    firstMeaningfulLine.length > 200 ? `${firstMeaningfulLine.slice(0, 200)}…` : firstMeaningfulLine;
  const toggleExpanded = () => setIsExpanded((prev) => !prev);
  const badgeClass = eventBadgeStyles[event.kind];
  const badgeLabel = eventBadgeLabel[event.kind];
  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    toggleExpanded();
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <article
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={`group cursor-pointer rounded-lg border border-border-subtle bg-bg-surface text-text-primary transition duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring ${isToolEvent ? "hover:border-border-strong border-l-2 border-l-text-muted" : "hover:border-border-strong shadow-sm"
        }`}
    >
      {isToolEvent ? (
        <div>
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-text-muted">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
                {badgeLabel}
              </span>
              <p className="text-xs font-medium text-text-primary truncate leading-tight font-mono">{titleText}</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
              <span className="whitespace-nowrap text-[10px] text-text-muted">
                {formatTimestamp(event.timestamp)}
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleExpanded();
                }}
                aria-expanded={isExpanded}
                className="flex h-6 w-6 items-center justify-center rounded border border-border-subtle bg-bg-elevated text-text-muted transition duration-150 hover:bg-state-hover hover:text-text-primary"
              >
                <span className="sr-only">{isExpanded ? "Collapse details" : "Expand details"}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  className={`h-3 w-3 transform transition ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
                </svg>
              </button>
            </div>
          </div>
          {!isExpanded && (
            <div className="space-y-1 px-3 pb-3 text-[11px] text-text-muted font-mono">
              {argsPreview && (
                <p className="truncate">
                  <span className="text-text-muted/60">Args:</span> {argsPreview}
                </p>
              )}
              <p className="truncate">
                <span className="text-text-muted/60">Result:</span>{" "}
                {collapsedPreview || "No output yet"}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-text-muted">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
              <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
                {badgeLabel}
              </span>
              <span>{event.phaseLabel ?? (isToolEvent ? "Tool call" : "Agent log")}</span>
            </div>
            <p className="text-xs font-medium text-text-primary truncate leading-tight mt-1">{titleText}</p>
            <p className="text-[11px] text-text-secondary truncate mt-0.5">{collapsedPreview || "No response yet."}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-[10px] text-text-muted">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded();
              }}
              aria-expanded={isExpanded}
              className="flex h-6 w-6 items-center justify-center rounded border border-border-subtle bg-bg-elevated text-text-muted transition duration-150 hover:bg-state-hover hover:text-text-primary"
            >
              <span className="sr-only">{isExpanded ? "Collapse details" : "Expand details"}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                className={`h-3 w-3 transform transition ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
              </svg>
            </button>
            <span className="font-mono">{formatTimestamp(event.timestamp)}</span>
          </div>
        </div>
      )}

      {agentMarkdown && (
        <section className="space-y-2 border-t border-border-subtle px-3 pb-3 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-text-muted">Markdown</p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleCopyMarkdown();
              }}
              className="flex items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-3 py-1 text-[10px] text-text-secondary transition hover:bg-state-hover hover:text-text-primary"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h5M9 13h5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l5 5" />
              </svg>
              <span>
                {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Error" : "Copy"}
              </span>
            </button>
          </div>
          <div className="rounded-lg border border-border-subtle bg-bg-surface p-3 text-[13px] leading-relaxed text-text-primary whitespace-pre-wrap break-words">
            {agentMarkdown}
          </div>
        </section>
      )}
      <div className={!isExpanded ? "hidden" : "grid gap-3 border-t border-border-subtle px-3 pb-4 pt-2"} role="region">
        {event.name && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
            <span className="font-semibold text-text-primary">Tool</span>
            <span>{event.name}</span>
            <span className="text-text-muted/70">{toolMeta ? "registered" : "external"}</span>
          </div>
        )}
        {isToolEvent && formattedArgs && (
          <section>
            <p className="text-[11px] text-text-muted">Arguments</p>
            <pre className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface p-3 text-[12px] leading-relaxed text-text-secondary whitespace-pre-wrap break-words scrollbar-elegant">
              {formattedArgs}
            </pre>
          </section>
        )}
        {isToolEvent && event.toolNote && event.toolNote.trim().length > 0 && (
          <section>
            <p className="text-[11px] text-text-muted">Assistant message</p>
            <pre className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] leading-relaxed text-amber-100 whitespace-pre-wrap break-words scrollbar-elegant">
              {event.toolNote}
            </pre>
          </section>
        )}
        <section>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-[11px] text-text-muted">
              Result{isToolEvent ? "" : " / Assistant message"}
            </p>
            {event.kind === "assistant" && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCopyResponse();
                  }}
                  className="flex items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-3 py-1 text-[10px] text-text-secondary transition hover:bg-state-hover hover:text-text-primary"
                  aria-label="Copy agent response"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6a2 2 0 0 1 2 2v6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V5H5" />
                  </svg>
                  <span className="whitespace-nowrap">
                    {copyResponseStatus === "copied"
                      ? "Copied"
                      : copyResponseStatus === "error"
                        ? "Error"
                        : "Copy"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsFullScreen(true);
                  }}
                  className="flex items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-3 py-1 text-[10px] text-text-secondary transition hover:bg-state-hover hover:text-text-primary"
                  aria-label="View full screen"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                  <span className="whitespace-nowrap">Full screen</span>
                </button>
              </>
            )}
            {isToolEvent && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsFullScreen(true);
                }}
                className="flex items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-3 py-1 text-[10px] text-text-secondary transition hover:bg-state-hover hover:text-text-primary"
                aria-label="View full screen"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                <span className="whitespace-nowrap">Full screen</span>
              </button>
            )}
          </div>
          {event.name === "semantic_code_search" || resultText.includes("Semantic Search Preview") ? (
            <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface p-3 text-[12px] leading-relaxed text-text-primary scrollbar-elegant">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    return !inline ? (
                      <div className="bg-bg-elevated border border-border-subtle rounded-md my-2 overflow-hidden">
                        <pre className="p-2 overflow-x-auto text-xs font-mono !bg-transparent !m-0">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    ) : (
                      <code className="bg-bg-elevated px-1 py-0.5 rounded text-sky-300 font-mono text-[90%]" {...props}>
                        {children}
                      </code>
                    )
                  },
                  h1({ children }: any) { return <h1 className="text-lg font-bold text-text-primary mt-4 mb-2 pb-1 border-b border-border-subtle">{children}</h1> },
                  h2({ children }: any) { return <h2 className="text-base font-bold text-text-primary mt-3 mb-2">{children}</h2> },
                  h3({ children }: any) { return <h3 className="text-sm font-bold text-text-primary mt-2 mb-1">{children}</h3> },
                  a({ children, href }: any) {
                    return <a href={href} className="text-emerald-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
                  },
                }}
              >
                {resultText}
              </ReactMarkdown>
            </div>
          ) : (
            <pre className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface p-3 text-[12px] leading-relaxed text-text-primary whitespace-pre-wrap break-words scrollbar-elegant">
              {resultText}
            </pre>
          )}
        </section>
        {isToolEvent && toolMeta && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openToolDialog(toolMeta)}
              className="rounded-md border border-border-subtle bg-bg-surface px-3 py-1 text-[10px] text-text-secondary transition hover:bg-state-hover hover:text-text-primary"
            >
              View tool details
            </button>
          </div>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <Modal
          open={isFullScreen}
          onClose={() => setIsFullScreen(false)}
          title="Agent Response"
          subtitle={titleText}
          fullHeight
        >
          <div className="h-full w-full overflow-auto p-8 bg-bg-surface text-text-secondary">
            <div className="max-w-4xl mx-auto prose prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    return !inline ? (
                      <div className="bg-bg-elevated border border-border-subtle rounded-md my-6 overflow-hidden not-prose">
                        <div className="bg-bg-app px-3 py-1.5 border-b border-border-subtle flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/20 border border-rose-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
                          </div>
                        </div>
                        <pre className="p-4 overflow-x-auto text-sm font-mono !bg-transparent !m-0">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    ) : (
                      <code className="bg-bg-elevated px-1.5 py-0.5 rounded text-sky-300 font-mono text-[90%]" {...props}>
                        {children}
                      </code>
                    )
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-8 rounded-lg border border-border-subtle shadow-sm not-prose">
                        <table className="min-w-full divide-y divide-border-subtle text-sm text-left">
                          {children}
                        </table>
                      </div>
                    )
                  },
                  thead({ children }) {
                    return <thead className="bg-bg-elevated/50 font-semibold text-text-primary">{children}</thead>
                  },
                  th({ children }) {
                    return <th className="px-6 py-3 whitespace-nowrap tracking-wider uppercase text-xs font-bold text-text-muted">{children}</th>
                  },
                  tr({ children }) {
                    return <tr className="hover:bg-white/5 transition-colors border-b border-border-subtle/50 last:border-0">{children}</tr>
                  },
                  td({ children }) {
                    return <td className="px-6 py-4">{children}</td>
                  },
                  a({ children, href }) {
                    return <a href={href} className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors no-underline font-medium" target="_blank" rel="noopener noreferrer">{children}</a>
                  },
                  blockquote({ children }) {
                    return <blockquote className="border-l-4 border-emerald-500/30 pl-6 py-2 italic text-text-muted my-8 bg-emerald-500/5 rounded-r-lg not-prose">{children}</blockquote>
                  },
                  h1({ children }) { return <h1 className="text-3xl font-bold text-text-primary mt-12 mb-6 pb-4 border-b border-border-subtle">{children}</h1> },
                  h2({ children }) { return <h2 className="text-2xl font-bold text-text-primary mt-10 mb-4 flex items-center gap-3"><span className="text-emerald-500">#</span> {children}</h2> },
                  h3({ children }) { return <h3 className="text-xl font-bold text-text-primary mt-8 mb-3">{children}</h3> },
                  hr() { return <hr className="border-border-subtle my-10" /> },
                  ul({ children }) { return <ul className="list-disc pl-6 space-y-2 my-4 marker:text-emerald-500/60">{children}</ul> },
                  ol({ children }) { return <ol className="list-decimal pl-6 space-y-2 my-4 marker:text-emerald-500/60">{children}</ol> },
                  p({ children }) { return <p className="leading-7 my-4 text-text-secondary text-[15px]">{children}</p> }
                }}
              >
                {resultText}
              </ReactMarkdown>
            </div>
          </div>
        </Modal>
      </div>
    </article>
  );
}

export default function HomePage() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedGraphKey, setSelectedGraphKey] = useState<string>("");
  const [graphPrefsLoaded, setGraphPrefsLoaded] = useState(false);
  const [agentGraphs, setAgentGraphs] = useState<AgentGraphRecord[]>([]);
  const [targetDir, setTargetDir] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [eventStream, setEventStream] = useState<AgentEvent[]>(() => [createSystemEvent()]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<AgentWorkflowResult["outputs"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [auditContext, setAuditContext] = useState<AuditContext>({});
  const [auditContextEnabled, setAuditContextEnabled] = useState(true);
  const [isAuditContextDialogOpen, setIsAuditContextDialogOpen] = useState(false);
  const [llmInfo, setLlmInfo] = useState<LlmEnvInfo | null>(null);
  const [modelProvider, setModelProvider] = useState<LlmProviderType>("azure");
  const [enabledProviders, setEnabledProviders] = useState<LlmProviderType[]>(["azure", "openai", "claude", "gemini", "lmstudio", "ollama"]);
  const [lmStudioModel, setLmStudioModel] = useState("");
  const [llmPrefsLoaded, setLlmPrefsLoaded] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [tools, setTools] = useState<McpToolMeta[]>([]);
  const [toolCodeCache, setToolCodeCache] = useState<Record<string, string>>({});
  const [toolLoadingMap, setToolLoadingMap] = useState<Record<string, boolean>>({});
  const [selectedTool, setSelectedTool] = useState<McpToolMeta | null>(null);
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [hasAuditStarted, setHasAuditStarted] = useState(false);
  const [isGraphInfoOpen, setIsGraphInfoOpen] = useState(false);
  const [isLlmInfoOpen, setIsLlmInfoOpen] = useState(false);
  const [detailGraph, setDetailGraph] = useState<GraphOption | null>(null);
  const [detailProvider, setDetailProvider] = useState<LlmProviderType | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(false);

  // Derived token usage from streaming outputs
  const tokenUsage = useMemo((): TokenUsageForDisplay | undefined => {
    const meta = outputs?.meta;
    if (!meta || typeof meta !== "object") return undefined;
    const usage = (meta as Record<string, unknown>).tokenUsage;
    if (!usage || typeof usage !== "object") return undefined;
    const u = usage as Record<string, unknown>;
    if (typeof u.totalTokens !== "number") return undefined;
    return {
      totalInputTokens: typeof u.totalInputTokens === "number" ? u.totalInputTokens : 0,
      totalOutputTokens: typeof u.totalOutputTokens === "number" ? u.totalOutputTokens : 0,
      totalTokens: u.totalTokens,
      callCount: typeof u.callCount === "number" ? u.callCount : 0,
    };
  }, [outputs]);

  const eventStreamRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputPanelHeight = 160;

  useEffect(() => {
    fetch("/api/tools/list")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTools(data);
        }
      })
      .catch(() => setTools([]));
  }, []);

  // Session restoration: check for active run on mount
  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const restoreSession = async () => {
      try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!stored) return;

        const session = JSON.parse(stored) as { runId: string; graphId: string; startedAt: string };
        if (!session.runId) return;

        setIsRestoringSession(true);
        setActiveRunId(session.runId);

        // Fetch the run status
        const res = await fetch(`/api/agent-graph-runs/${session.runId}`);
        if (!res.ok) {
          // Run not found, clear session
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setActiveRunId(null);
          setIsRestoringSession(false);
          return;
        }

        const data = await res.json();
        const run = data.run;

        if (!isMounted) return;

        // Set graph selection to match the restored run
        if (session.graphId) {
          setSelectedGraphKey(`agent:${session.graphId}`);
        }

        setHasAuditStarted(true);

        // If run is still running, start polling
        if (run.status === "RUNNING") {
          setLoading(true);

          // Create a user event from the mission/userInput
          const userMessage = run.state?.userInput || run.state?.mission || "Restored session";
          const userEvent: AgentEvent = {
            id: `user-restored-${Date.now()}`,
            phaseId: "user",
            phaseLabel: "User input",
            kind: "user",
            role: "user",
            content: userMessage,
            timestamp: session.startedAt,
          };
          setEventStream([createSystemEvent(), userEvent]);

          // Poll for updates
          const pollForUpdates = async () => {
            if (!isMounted) return;
            try {
              const pollRes = await fetch(`/api/agent-graph-runs/${session.runId}`);
              if (!pollRes.ok) return;
              const pollData = await pollRes.json();
              const pollRun = pollData.run;

              if (!isMounted) return;

              // Update status based on run status
              if (pollRun.status === "COMPLETED" || pollRun.status === "FAILED") {
                if (pollInterval) clearInterval(pollInterval);
                setLoading(false);
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
                setActiveRunId(null);

                // Add a completion/error event
                const completionEvent: AgentEvent = {
                  id: `completion-${Date.now()}`,
                  phaseId: "final",
                  phaseLabel: pollRun.status === "COMPLETED" ? "Completed" : "Failed",
                  kind: "assistant",
                  role: "assistant",
                  content: pollRun.status === "COMPLETED"
                    ? "Session completed while you were away. View the run details in History."
                    : `Session failed: ${pollRun.error || "Unknown error"}`,
                  timestamp: new Date().toISOString(),
                };
                setEventStream((prev) => [...prev, completionEvent]);
              }
            } catch {
              // Ignore polling errors
            }
          };

          pollInterval = setInterval(pollForUpdates, 2000);
        } else {
          // Run is completed or failed - show restored state message
          const userMessage = run.state?.userInput || run.state?.mission || "Previous session";
          const userEvent: AgentEvent = {
            id: `user-restored-${Date.now()}`,
            phaseId: "user",
            phaseLabel: "User input",
            kind: "user",
            role: "user",
            content: userMessage,
            timestamp: session.startedAt,
          };

          const statusEvent: AgentEvent = {
            id: `status-${Date.now()}`,
            phaseId: "final",
            phaseLabel: run.status === "COMPLETED" ? "Completed" : "Failed",
            kind: "assistant",
            role: "assistant",
            content: run.status === "COMPLETED"
              ? "Previous session completed. You can view details in History or start a new session."
              : `Previous session failed: ${run.error || "Unknown error"}`,
            timestamp: new Date().toISOString(),
          };

          setEventStream([createSystemEvent(), userEvent, statusEvent]);

          // Clear the session storage since run is done
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setActiveRunId(null);
        }
      } catch {
        // Ignore restoration errors - just start fresh
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    const loadGraphs = async () => {
      try {
        // Fetch both graphs and user preferences in parallel
        const [graphsRes, prefsRes] = await Promise.all([
          fetch("/api/agent-graphs", { cache: "no-store" }),
          fetch("/api/user-preferences").catch(() => null)
        ]);

        const graphsData = await graphsRes.json();
        const list = Array.isArray(graphsData?.graphs) ? (graphsData.graphs as AgentGraphRecord[]) : [];
        setAgentGraphs(list);

        // Try API preferences first, then localStorage, then auto-select
        let savedGraphKey: string | null = null;
        if (prefsRes?.ok) {
          const prefsData = await prefsRes.json();
          if (prefsData.success && prefsData.preferences?.selectedGraphId) {
            savedGraphKey = prefsData.preferences.selectedGraphId;
          }
        }

        // Fallback to localStorage
        if (!savedGraphKey) {
          savedGraphKey = window.localStorage.getItem("numezis-graph-selection");
        }

        // Apply saved selection or auto-select first
        if (savedGraphKey && list.some(g => `agent:${g._id}` === savedGraphKey)) {
          setSelectedGraphKey(savedGraphKey);
        } else if (list.length > 0 && !selectedGraphKey) {
          setSelectedGraphKey(`agent:${list[0]._id}`);
        }
        setGraphPrefsLoaded(true);
      } catch {
        setAgentGraphs([]);
        setGraphPrefsLoaded(true);
      }
    };
    void loadGraphs();
  }, []);

  useEffect(() => {
    const loadLlmPreferences = async () => {
      try {
        // Try to load from user-preferences API first
        const prefsRes = await fetch("/api/user-preferences").catch(() => null);
        if (prefsRes?.ok) {
          const prefsData = await prefsRes.json();
          if (prefsData.success && prefsData.preferences?.selectedLlmProvider) {
            const provider = prefsData.preferences.selectedLlmProvider as LlmProviderType;
            if (["azure", "openai", "claude", "gemini", "lmstudio", "ollama"].includes(provider)) {
              setModelProvider(provider);
              setLlmPrefsLoaded(true);
              return;
            }
          }
        }
      } catch {
        // Fall through to localStorage
      }

      // Fallback to localStorage
      const stored = window.localStorage.getItem("numezis-llm-selection");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { provider?: string; model?: string };
          if (parsed.provider && ["azure", "openai", "claude", "gemini", "lmstudio", "ollama"].includes(parsed.provider)) {
            setModelProvider(parsed.provider as LlmProviderType);
          }
          if (typeof parsed.model === "string") {
            setLmStudioModel(parsed.model);
          }
        } catch {
          // Ignore malformed cache entries.
        }
      }
      setLlmPrefsLoaded(true);
    };
    void loadLlmPreferences();
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("numezis-audit-context");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
        enabled?: boolean;
        context?: AuditContext;
      };
      if (typeof parsed.enabled === "boolean") {
        setAuditContextEnabled(parsed.enabled);
      }
      if (parsed.context && typeof parsed.context === "object") {
        setAuditContext(parsed.context);
      }
    } catch {
      // Ignore malformed cache entries.
    }
  }, []);

  const { status: llmStatus } = useLlmHealth(modelProvider);

  // Fetch enabled providers from API
  useEffect(() => {
    fetch("/api/llm-config/enable")
      .then((res) => res.json())
      .then((data) => {
        if (data.enabledProviders) {
          setEnabledProviders(data.enabledProviders);
        }
      })
      .catch((err) => console.error("Failed to fetch enabled providers", err));
  }, []);

  useEffect(() => {
    fetch("/api/env")
      .then((res) => res.json())
      .then((data: { targetDir?: string | null; llm?: LlmEnvInfo }) => {
        setTargetDir(data.targetDir || null);
        setLlmInfo(data.llm ?? null);

        // Always ensure lmStudioModel is populated from DB config if empty
        // This fixes the issue where localStorage has provider but empty model
        setLmStudioModel((current) => {
          if (current && current.trim()) return current; // Keep existing value
          return data.llm?.lmstudio?.model ?? "";
        });

        if (!window.localStorage.getItem("numezis-llm-selection")) {
          const defaultProvider = (data.llm?.defaultProvider as LlmProviderType) || "azure";
          setModelProvider(defaultProvider);
        }
      })
      .catch(() => setTargetDir(null));
  }, []);

  useEffect(() => {
    if (!llmPrefsLoaded) return;
    const payload = {
      provider: modelProvider,
      model: lmStudioModel,
    };
    window.localStorage.setItem("numezis-llm-selection", JSON.stringify(payload));
  }, [modelProvider, lmStudioModel, llmPrefsLoaded]);

  // Persist graph selection to localStorage
  useEffect(() => {
    if (!graphPrefsLoaded || !selectedGraphKey) return;
    window.localStorage.setItem("numezis-graph-selection", selectedGraphKey);
    // Persist to user preferences for cross-session persistence (fire-and-forget)
    fetch('/api/user-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedGraphId: selectedGraphKey })
    }).catch(() => { /* Silently fail, localStorage is fallback */ });
  }, [selectedGraphKey, graphPrefsLoaded]);

  useEffect(() => {
    const payload = {
      enabled: auditContextEnabled,
      context: auditContext,
    };
    window.localStorage.setItem("numezis-audit-context", JSON.stringify(payload));
  }, [auditContext, auditContextEnabled]);

  const handleProviderChange = useCallback(async (provider: LlmProviderType) => {
    setModelProvider(provider);

    try {
      await Promise.all([
        fetch('/api/llm-config/provider', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider })
        }),
        fetch('/api/embedding-config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider })
        }),
        // Persist to user preferences for cross-session persistence
        fetch('/api/user-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedLlmProvider: provider })
        })
      ]);
    } catch (err) {
      console.error("Failed to sync provider to backend", err);
    }
  }, []);

  useEffect(() => {
    setLlmError(null);
  }, [modelProvider, lmStudioModel]);

  const handleCopyPath = useCallback((path: string) => {
    if (!path) return;
    void navigator.clipboard.writeText(path).then(() => {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    });
  }, []);

  const auditContextSummary = useMemo(
    () => formatAuditContextSummary(auditContext),
    [auditContext]
  );

  const targetPathEntry = useMemo(() => {
    if (targetDir) {
      return { label: "Target repo", value: targetDir };
    }
    return null;
  }, [targetDir]);

  const fetchToolCode = (toolName: string) => {
    setToolLoadingMap((prev) => ({ ...prev, [toolName]: true }));
    fetch(`/api/tools/${toolName}`)
      .then((res) => res.json())
      .then((data) => {
        setToolCodeCache((prev) => ({ ...prev, [toolName]: data.code ?? "// Source unavailable." }));
      })
      .catch(() =>
        setToolCodeCache((prev) => ({ ...prev, [toolName]: "// Unable to load tool code." }))
      )
      .finally(() => setToolLoadingMap((prev) => ({ ...prev, [toolName]: false })));
  };

  useEffect(() => {
    if (eventStreamRef.current) {
      eventStreamRef.current.scrollTop = eventStreamRef.current.scrollHeight;
    }
  }, [eventStream]);

  const readEventStream = async (response: Response) => {
    if (!response.body) {
      throw new Error("No streaming body available.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const processLine = (line: string) => {
      if (!line) return;
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(line);
      } catch {
        return;
      }
      if (chunk.type === "init") {
        // Store runId for session persistence
        setActiveRunId(chunk.payload.runId);
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
            runId: chunk.payload.runId,
            graphId: chunk.payload.graphId,
            startedAt: new Date().toISOString(),
          }));
        } catch {
          // sessionStorage may be unavailable
        }
        return;
      }
      if (chunk.type === "update" || chunk.type === "final") {
        setTimeline(chunk.payload.timeline);
        setEventStream(chunk.payload.eventStream);
        if (chunk.payload.outputs) {
          setOutputs(chunk.payload.outputs);
        }
        // Clear session storage on final since run is complete
        if (chunk.type === "final") {
          try {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          } catch {
            // sessionStorage may be unavailable
          }
          setActiveRunId(null);
        }
        return;
      }
      if (chunk.type === "error") {
        const errorEvent: AgentEvent = {
          id: `stream-error-${Date.now()}`,
          phaseId: "user",
          phaseLabel: "Error",
          kind: "assistant",
          role: "assistant",
          content: `Agent stream error: ${chunk.payload.message}`,
          timestamp: new Date().toISOString(),
        };
        setEventStream((prev) => [...prev, errorEvent]);
        throw new Error(chunk.payload.message);
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          processLine(line);
        }
      }
      if (buffer.trim()) {
        processLine(buffer.trim());
      }
    } finally {
      reader.releaseLock();
    }
  };

  const selectedAgentGraphId = selectedGraphKey.startsWith("agent:") ? selectedGraphKey.slice("agent:".length) : null;
  const selectedAgentGraph =
    selectedAgentGraphId ? agentGraphs.find((g) => String(g._id) === selectedAgentGraphId) ?? null : null;

  // No longer using built-in graphs - only DB agent graphs
  const selectedGraph = graphOptions[0]; // Fallback for type compatibility only

  const selectedGraphLabel = selectedAgentGraph?.name ?? selectedGraph.name;

  const graphToolNames = selectedAgentGraph
    ? Array.from(
      new Set(
        (selectedAgentGraph.nodes ?? []).flatMap((n) => (Array.isArray(n.react?.toolNames) ? n.react!.toolNames! : []))
      )
    )
    : (selectedGraph.toolNames ?? []);
  const activePhaseDefinitions = useMemo(() => {
    if (timeline.length) {
      return timeline.map((event) => ({
        id: event.id,
        label: event.label,
        summary: event.summary,
        description: event.details ?? "",
        systemPrompt: event.systemPrompt ?? "",
      }));
    }
    if (selectedAgentGraph) {
      return (selectedAgentGraph.nodes ?? []).map((n) => ({
        id: n.id,
        label: n.label,
        summary: "",
        description: selectedAgentGraph.description ?? "",
        systemPrompt: n.react?.systemPrompt ?? "",
      }));
    }
    return selectedGraph.phases;
  }, [timeline, selectedGraph, selectedAgentGraph]);

  const nodePromptOverrides = useMemo(() => {
    if (!timeline.length) return new Map<string, string>();
    return new Map(
      timeline
        .filter((entry) => typeof entry.systemPrompt === "string")
        .map((entry) => [entry.id, entry.systemPrompt ?? ""])
    );
  }, [timeline]);

  const displayNodePrompts = useMemo(() => {
    if (selectedAgentGraph) {
      return (selectedAgentGraph.nodes ?? []).map((n) => ({
        id: n.id,
        label: n.label,
        prompt: n.react?.systemPrompt ?? "",
      }));
    }
    return selectedGraph.nodePrompts.map((nodePrompt) => ({
      ...nodePrompt,
      prompt: nodePromptOverrides.get(nodePrompt.id) ?? nodePrompt.prompt,
    }));
  }, [selectedAgentGraph, selectedGraph.nodePrompts, nodePromptOverrides]);

  const graphTools = useMemo(() => {
    if (!graphToolNames.length) return tools;
    return tools.filter((tool) => graphToolNames.includes(tool.name));
  }, [tools, graphToolNames]);
  const azureConfigured = llmInfo?.azure?.configured ?? false;
  const lmStudioBaseUrl = llmInfo?.lmstudio?.baseUrl ?? "http://127.0.0.1:1234/v1";

  const handleSendMessage = async () => {
    if (loading) return;
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage) return;
    setLlmError(null);
    if (modelProvider === "azure" && llmInfo && !llmInfo.azure?.configured) {
      setLlmError("Azure OpenAI is not configured. Update AZURE_OPENAI_* in your env.");
      return;
    }
    if (modelProvider === "lmstudio" && !lmStudioModel.trim()) {
      setLlmError("LM Studio model name is required before sending.");
      return;
    }

    // Agent-graph selection: stream progress directly in Workbench (no redirect).
    if (selectedAgentGraphId) {
      setHasAuditStarted(true);
      const userEvent: AgentEvent = {
        id: `user-${Date.now()}`,
        phaseId: "user",
        phaseLabel: "User input",
        kind: "user",
        role: "user",
        content: trimmedMessage,
        timestamp: new Date().toISOString(),
      };

      setEventStream([createSystemEvent(), userEvent]);
      setOutputs(null);
      setTimeline([]);
      setSelectedEventId(activePhaseDefinitions[0]?.id ?? null);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setLoading(true);
      try {
        const response = await fetch(`/api/agent-graphs/${selectedAgentGraphId}/stream`, {
          signal: controller.signal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmedMessage,
            provider: modelProvider,
            model: modelProvider === "lmstudio" ? lmStudioModel.trim() : undefined,
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || response.statusText);
        }
        await readEventStream(response);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setEventStream((prev) => [
          ...prev,
          {
            id: `agent-error-${Date.now()}`,
            phaseId: "user",
            phaseLabel: "Error",
            kind: "assistant",
            role: "assistant",
            content: `Agent graph error: ${(error as Error).message}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
      return;
    }

    setHasAuditStarted(true);
    const normalizedAuditContext = auditContextEnabled
      ? normalizeAuditContext(auditContext)
      : null;
    const userEvent: AgentEvent = {
      id: `user-${Date.now()}`,
      phaseId: "user",
      phaseLabel: "User input",
      kind: "user",
      role: "user",
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
    };

    setEventStream([createSystemEvent(), userEvent]);
    setOutputs(null);
    setTimeline([]);
    setSelectedEventId(activePhaseDefinitions[0]?.id ?? null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch("/api/chat/stream", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          graph: selectedGraph.id, // Use the fallback graph ID
          provider: modelProvider,
          model: modelProvider === "lmstudio" ? lmStudioModel.trim() : undefined,
          auditContext: normalizedAuditContext ?? undefined,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }
      await readEventStream(response);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      setEventStream((prev) => [
        ...prev,
        {
          id: `agent-error-${Date.now()}`,
          phaseId: "user",
          phaseLabel: "Error",
          kind: "assistant",
          role: "assistant",
          content: `Agent error: ${(error as Error).message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (!loading) return;
    abortControllerRef.current?.abort();
    setLoading(false);
  };

  const handleMessageInputKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send (without Shift)
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSendMessage && !loading) {
        void handleSendMessage();
      }
    }
    // Shift+Enter for new line (default behavior)
  };

  // Auto-expand textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [messageInput]);

  const canSendMessage = Boolean(messageInput.trim());

  const toolLookup = useMemo(() => new Map(tools.map((tool) => [tool.name, tool])), [tools]);
  const usedToolNames = useMemo(
    () =>
      new Set(
        eventStream
          .filter((event) => event.kind === "tool" && event.name)
          .map((event) => event.name as string)
      ),
    [eventStream]
  );
  const coalescedEventStream = useMemo(() => {
    if (!eventStream.length) return eventStream;
    const merged: AgentEvent[] = [];
    const pendingById = new Map<string, { toolArgs?: string; name?: string; phaseId?: string; toolNote?: string }>();
    const pendingByName = new Map<
      string,
      Array<{ toolArgs?: string; name?: string; phaseId?: string; toolNote?: string }>
    >();
    const nameKey = (event: AgentEvent) => `${event.phaseId}:${event.name ?? "tool"}`;

    for (const event of eventStream) {
      if (event.kind === "tool") {
        const isToolStart = event.role !== "tool";
        const hasContent = Boolean(event.content && event.content.trim());
        if (isToolStart) {
          if (event.toolCallId) {
            pendingById.set(event.toolCallId, {
              toolArgs: event.toolArgs,
              name: event.name,
              phaseId: event.phaseId,
              toolNote: event.toolNote,
            });
          } else {
            const key = nameKey(event);
            const queue = pendingByName.get(key) ?? [];
            queue.push({
              toolArgs: event.toolArgs,
              name: event.name,
              phaseId: event.phaseId,
              toolNote: event.toolNote,
            });
            pendingByName.set(key, queue);
          }
          continue;
        }

        if (hasContent) {
          let pending = event.toolCallId ? pendingById.get(event.toolCallId) : undefined;
          if (event.toolCallId && pending) {
            pendingById.delete(event.toolCallId);
          }
          if (!pending) {
            const key = nameKey(event);
            const queue = pendingByName.get(key);
            if (queue && queue.length) {
              pending = queue.shift();
              if (!queue.length) {
                pendingByName.delete(key);
              }
            }
          }
          if (pending) {
            merged.push({
              ...event,
              toolArgs: pending.toolArgs ?? event.toolArgs,
              name: event.name ?? pending.name,
              toolNote: event.toolNote ?? pending.toolNote,
            });
            continue;
          }
        }
      }
      if (event.kind === "tool" && (!event.content || !event.content.trim())) {
        continue;
      }
      merged.push(event);
    }
    return merged;
  }, [eventStream]);
  const visibleEventStream = useMemo(() => {
    const hasNonSystemEvent = coalescedEventStream.some((event) => event.kind !== "system");
    if (!hasNonSystemEvent) {
      return [];
    }
    return coalescedEventStream.filter((event) => event.kind !== "system");
  }, [coalescedEventStream]);
  useEffect(() => {
    if (!visibleEventStream.length) return;
    let frame = 0;
    const scrollToBottom = () => {
      if (eventStreamRef.current) {
        eventStreamRef.current.scrollTop = eventStreamRef.current.scrollHeight;
      }
    };
    frame = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(frame);
  }, [visibleEventStream]);
  const handlePhaseClick = (eventId: string) => {
    setSelectedEventId(eventId);
    setIsDetailDialogOpen(true);
  };
  const openToolDialog = (tool: McpToolMeta) => {
    setSelectedTool(tool);
    setIsToolDialogOpen(true);
    if (!toolCodeCache[tool.name]) {
      fetchToolCode(tool.name);
    }
  };

  const placeholderTimeline: TimelineEvent[] = activePhaseDefinitions.map((phase) => ({
    id: phase.id,
    label: phase.label,
    status: "pending",
    summary: phase.summary,
    details: phase.description,
    systemPrompt: phase.systemPrompt,
    thoughtLog: [],
  }));

  const activeTimeline = hasAuditStarted
    ? timeline.length
      ? timeline
      : placeholderTimeline
    : [];
  const selectedEvent =
    activeTimeline.find((entry) => entry.id === selectedEventId) ?? activeTimeline[0] ?? null;

  useEffect(() => {
    if (!selectedEvent) {
      setIsDetailDialogOpen(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (!activeTimeline.length) return;
    setSelectedEventId((current) => {
      if (current && activeTimeline.some((entry) => entry.id === current)) {
        return current;
      }
      return activeTimeline[0].id;
    });
  }, [activeTimeline]);

  return (
    <div className="h-full overflow-hidden bg-bg-app text-text-primary font-sans antialiased selection:bg-state-selected selection:text-text-primary">
      <div className="flex h-full flex-col bg-bg-app">
        <HeaderControls
          selectedGraphKey={selectedGraphKey}
          selectedGraphLabel={selectedGraphLabel}
          selectedGraph={selectedGraph}
          agentGraphs={agentGraphs}
          onSelectGraphKey={setSelectedGraphKey}
          modelProvider={modelProvider}
          onSelectProvider={handleProviderChange}
          azureConfigured={azureConfigured}
          llmInfo={llmInfo}
          lmStudioBaseUrl={lmStudioBaseUrl}
          lmStudioModel={lmStudioModel}
          onLmStudioModelChange={setLmStudioModel}
          llmError={llmError}
          auditContextEnabled={auditContextEnabled}
          onAuditContextEnabledChange={setAuditContextEnabled}
          auditContextSummary={auditContextSummary}
          onConfigureAuditContext={() => setIsAuditContextDialogOpen(true)}
          isGraphInfoOpen={isGraphInfoOpen}
          onSetGraphInfoOpen={setIsGraphInfoOpen}
          isLlmInfoOpen={isLlmInfoOpen}
          onSetLlmInfoOpen={setIsLlmInfoOpen}
          detailGraph={detailGraph}
          onSetDetailGraph={setDetailGraph}
          detailProvider={detailProvider}
          onSetDetailProvider={setDetailProvider}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        <div className="flex-1 min-h-0 min-w-0 flex gap-0">
          <div className="flex-1 min-h-0 min-w-0 flex flex-col">
            <main className="flex h-full min-h-0 w-full flex-col bg-bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Activity log
                </h2>
              </div>

              <div className="relative flex flex-1 flex-col gap-3 overflow-hidden p-3 pt-2">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <div
                    ref={eventStreamRef}
                    className="h-full max-h-full min-h-0 space-y-3 overflow-y-auto pr-2 scrollbar-elegant"
                    style={{ paddingBottom: inputPanelHeight }}
                  >
                    {visibleEventStream.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        toolMeta={event.name ? toolLookup.get(event.name) : undefined}
                        openToolDialog={openToolDialog}
                      />
                    ))}
                    {loading && (
                      <div className="rounded-xl border border-dashed border-border-strong bg-bg-elevated/50 p-4 text-sm text-text-muted">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-text-secondary animate-pulse" />
                            <p className="text-[13px] font-medium text-text-primary">
                              Agent running...
                            </p>
                          </div>
                          <p className="text-[11px] text-text-muted">
                            Tracking phases and tools · final summary incoming
                          </p>
                          <div className="h-[4px] w-full overflow-hidden rounded-full bg-bg-elevated mt-1">
                            <div className="h-full w-full bg-text-muted animate-progress-loader opacity-30" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Refined Cursor-style input area */}
                <div className="sticky bottom-0 bg-bg-surface px-4 py-4 backdrop-blur-md">
                  <div className="mx-auto max-w-4xl">
                    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-3 shadow-lg transition-all focus-within:border-border-strong group">
                      <textarea
                        ref={textareaRef}
                        value={messageInput}
                        onChange={(event) => {
                          setMessageInput(event.target.value);
                        }}
                        onKeyDown={handleMessageInputKeyDown}
                        placeholder="Ask anything (⌘L), @ to mention, / for workflows"
                        rows={1}
                        className="w-full resize-none border-none bg-transparent p-0 text-[13px] font-medium text-text-primary outline-none focus:ring-0 placeholder:text-text-muted/60 scrollbar-elegant"
                        style={{
                          minHeight: '28px',
                          maxHeight: '160px',
                          height: 'auto'
                        }}
                      />

                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Mode Indicator - Clickable to open graph info */}
                          <div className="flex items-center gap-2">
                            <Selector
                              label="GRAPH"
                              value={selectedGraphKey}
                              options={[
                                ...agentGraphs.map(g => ({ id: `agent:${g._id}`, label: g.name, sub: 'Agent' }))
                              ]}
                              onSelect={setSelectedGraphKey}
                              direction="up"
                              loading={!graphPrefsLoaded}
                            />
                            <Selector
                              label="LLM"
                              value={modelProvider}
                              options={[
                                { id: 'azure', label: 'Azure OpenAI', sub: 'Cloud' },
                                { id: 'openai', label: 'OpenAI', sub: 'Cloud' },
                                { id: 'claude', label: 'Claude', sub: 'Cloud' },
                                { id: 'gemini', label: 'Gemini', sub: 'Cloud' },
                                { id: 'lmstudio', label: 'LM Studio', sub: 'Local' },
                                { id: 'ollama', label: 'Ollama', sub: 'Local' }
                              ].filter(opt => enabledProviders.includes(opt.id as LlmProviderType))}
                              onSelect={(id) => handleProviderChange(id as LlmProviderType)}
                              direction="up"
                              status={llmStatus}
                              loading={!llmPrefsLoaded}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Sending action */}

                          {/* Circular action button */}
                          <button
                            type="button"
                            onClick={loading ? handleStop : handleSendMessage}
                            disabled={!loading && !canSendMessage}
                            className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 ${loading
                              ? "bg-bg-surface border border-border-strong text-rose-500 scale-110 active:scale-95"
                              : "bg-text-primary text-bg-surface hover:opacity-90 disabled:opacity-20 disabled:cursor-not-allowed"
                              }`}
                          >
                            {loading ? (
                              <div className="h-2.5 w-2.5 bg-rose-500 rounded-sm animate-pulse" />
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l7.5 7.5a.75.75 0 11-1.06 1.06l-6.22-6.22V21a.75.75 0 01-1.5 0V4.81l-6.22 6.22a.75.75 0 11-1.06-1.06l7.5-7.5z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>

          <aside
            className={`min-w-0 flex-shrink-0 transition-all duration-300 ease-in-out border-l border-border-subtle bg-bg-surface ${isSidebarOpen
              ? "w-[360px] opacity-100"
              : "w-0 opacity-0 overflow-hidden pointer-events-none border-l-0"
              }`}
          >
            <div className="flex h-full w-[360px] flex-col">
              <div className="flex-1 min-h-0">
                <TimelinePanel
                  timeline={activeTimeline}
                  selectedEventId={selectedEventId}
                  onPhaseSelect={handlePhaseClick}
                  tokenUsage={tokenUsage}
                />
              </div>
              <div className="flex-1 min-h-0">
                <ToolExplorerPanel
                  tools={graphTools}
                  usedToolNames={usedToolNames}
                  openToolDialog={openToolDialog}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Modal
        open={Boolean(selectedEvent && isDetailDialogOpen)}
        onClose={() => setIsDetailDialogOpen(false)}
        title="Phase detail"
        subtitle={selectedEvent?.label}
      >
        {selectedEvent && (
          <div className="space-y-6">
            {selectedEvent.details && (
              <p className="text-xs text-text-muted">{selectedEvent.details}</p>
            )}
            <section className="space-y-3">
              <p className="text-[11px] text-text-muted">Graph prompts</p>
              <div className="max-h-72 space-y-3 overflow-y-auto pr-2 scrollbar-elegant">
                {displayNodePrompts.map((nodePrompt) => {
                  const isActive =
                    nodePrompt.id === selectedEvent.id ||
                    nodePrompt.id.startsWith(`${selectedEvent.id}_`);
                  return (
                    <div
                      key={nodePrompt.id}
                      className={`rounded-lg border p-3 ${isActive
                        ? "border-border-strong bg-state-selected"
                        : "border-border-subtle bg-bg-surface"
                        }`}
                    >
                      <p className="text-[11px] text-text-muted">
                        {nodePrompt.label}
                      </p>
                      <pre className="mt-2 text-[12px] leading-relaxed text-text-primary whitespace-pre-wrap break-words">
                        {nodePrompt.prompt || "Pending prompt..."}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-text-muted">Tool access</p>
                <span className="text-[11px] text-text-muted">
                  {selectedEvent.status}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {tools.map((tool) => {
                  const used = usedToolNames.has(tool.name);
                  return (
                    <button
                      key={tool.name}
                      type="button"
                      onClick={() => openToolDialog(tool)}
                      className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-left text-[12px] text-text-secondary transition hover:bg-state-hover hover:border-border-strong"
                    >
                      <span className="font-semibold text-text-primary">{tool.label}</span>
                      <span
                        className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-medium ${used ? "border-emerald-500/40 text-emerald-400" : "border-border-subtle text-text-muted"
                          }`}
                      >
                        {used ? "used" : "avail"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="space-y-2">
              <p className="text-[11px] text-text-muted">Assistant log</p>
              {selectedEvent.thoughtLog?.length ? (
                <ul className="max-h-72 space-y-2 overflow-y-auto scrollbar-elegant">
                  {selectedEvent.thoughtLog.map((thought: string, index: number) => (
                    <li
                      key={index}
                      className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-[11px] leading-5 text-text-secondary"
                    >
                      {thought}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-text-muted">No assistant messages captured for this phase.</p>
              )}
            </section>
          </div>
        )}
      </Modal>

      <Modal
        open={isAuditContextDialogOpen}
        onClose={() => setIsAuditContextDialogOpen(false)}
        title="Audit context"
        subtitle="Focus and goals"
      >
        <div className="space-y-4 text-sm text-text-secondary">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
            <button
              type="button"
              className="rounded-md border border-border-subtle bg-bg-surface px-3 py-1 text-[10px] font-medium text-text-primary transition hover:bg-state-hover"
              onClick={() => setAuditContext(mvpLaunchPreset)}
            >
              Use MVP launch preset
            </button>
            <button
              type="button"
              className="rounded-md border border-border-subtle bg-bg-surface px-3 py-1 text-[10px] font-medium text-text-muted transition hover:bg-state-hover hover:text-text-primary"
              onClick={() => setAuditContext({})}
            >
              Clear
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] text-text-muted">Startup phase</label>
              <select
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong"
                value={auditContext.startupPhase ?? ""}
                onChange={(event) =>
                  setAuditContext((prev) => ({
                    ...prev,
                    startupPhase: event.target.value || undefined,
                  }))
                }
              >
                <option value="">Select phase</option>
                {startupPhaseOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-muted">Time horizon</label>
              <input
                type="text"
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong"
                placeholder="e.g. Next 4-6 weeks"
                value={auditContext.timeHorizon ?? ""}
                onChange={(event) =>
                  setAuditContext((prev) => ({
                    ...prev,
                    timeHorizon: event.target.value || undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] text-text-muted">Mission</label>
              <input
                type="text"
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong"
                placeholder="Describe the mission succinctly"
                value={auditContext.mission ?? ""}
                onChange={(event) =>
                  setAuditContext((prev) => ({
                    ...prev,
                    mission: event.target.value || undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] text-text-muted">Primary goal</label>
              <input
                type="text"
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong"
                placeholder="The main objective this audit should optimize for"
                value={auditContext.primaryGoal ?? ""}
                onChange={(event) =>
                  setAuditContext((prev) => ({
                    ...prev,
                    primaryGoal: event.target.value || undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-muted">Risk tolerance</label>
              <select
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong"
                value={auditContext.riskTolerance ?? ""}
                onChange={(event) =>
                  setAuditContext((prev) => ({
                    ...prev,
                    riskTolerance: (event.target.value || undefined) as AuditContext["riskTolerance"],
                  }))
                }
              >
                <option value="">Select tolerance</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-muted">Target users</label>
              <input
                type="text"
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong"
                placeholder="e.g. Beta customers, internal team"
                value={auditContext.targetUsers ?? ""}
                onChange={(event) =>
                  setAuditContext((prev) => ({
                    ...prev,
                    targetUsers: event.target.value || undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] text-text-muted">Key objectives (one per line)</label>
              <textarea
                className="min-h-[80px] w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong"
                placeholder="List the objectives this audit must prioritize"
                value={(auditContext.keyObjectives ?? []).join("\n")}
                onChange={(event) =>
                  setAuditContext((prev) => ({
                    ...prev,
                    keyObjectives: parseMultilineList(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] text-text-muted">De-prioritize (one per line)</label>
              <textarea
                className="min-h-[70px] w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong"
                placeholder="Out-of-scope or later items"
                value={(auditContext.nonGoals ?? []).join("\n")}
                onChange={(event) =>
                  setAuditContext((prev) => ({
                    ...prev,
                    nonGoals: parseMultilineList(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] text-text-muted">Constraints (one per line)</label>
              <textarea
                className="min-h-[60px] w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong"
                placeholder="Hard constraints or invariants"
                value={(auditContext.constraints ?? []).join("\n")}
                onChange={(event) =>
                  setAuditContext((prev) => ({
                    ...prev,
                    constraints: parseMultilineList(event.target.value),
                  }))
                }
              />
            </div>
          </div>
          <p className="text-[11px] text-text-muted">
            This context is appended to every audit phase input and logged in the activity stream.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedTool && isToolDialogOpen)}
        onClose={() => {
          setIsToolDialogOpen(false);
          setSelectedTool(null);
        }}
        title="Tool detail"
        subtitle={selectedTool?.label}
      >
        {selectedTool && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{selectedTool.description}</p>
            {selectedTool.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px] text-text-muted">
                {selectedTool.categories.map((category) => (
                  <span key={category} className="rounded-md border border-border-subtle px-3 py-1">
                    {category}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-surface p-3 text-[12px] text-text-secondary">
              <p className="text-[11px] text-text-muted">Source</p>
              <pre className="max-h-64 overflow-y-auto rounded-lg bg-bg-elevated p-3 text-[11px] leading-relaxed text-text-primary whitespace-pre-wrap break-words scrollbar-elegant">
                {toolLoadingMap[selectedTool.name]
                  ? "Loading tool details..."
                  : toolCodeCache[selectedTool.name] || "// Source unavailable."}
              </pre>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
