"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";

import type { McpToolMeta } from "../src/tools/mcpToolMetadata";
import type {
  AgentEvent,
  AgentWorkflowResult,
  AgentWorkflowUpdate,
  TimelineEvent,
} from "../src/agentRunner";
import { graphOptions } from "../src/shared/graphCatalog";
import type { GraphId } from "../src/shared/graphCatalog";
import {
  formatAuditContextSummary,
  normalizeAuditContext,
  type AuditContext,
} from "../src/shared/auditContext";
import { AuditHistoryModal } from "../src/components/AuditHistoryModal";
import { AzureConfigForm, LMStudioConfigForm } from "../src/components/LlmConfigForms";
import { PromptSelectorModal } from "../src/components/PromptSelectorModal";

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
type StreamChunk =
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

type PromptFileEntry = {
  name: string;
  path: string;
};

type PromptFolderNode = {
  name: string;
  path: string;
  children: PromptFolderNode[];
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

import { Modal } from "../src/components/ui/Modal";

type TimelinePanelProps = {
  timeline: TimelineEvent[];
  selectedEventId: string | null;
  onPhaseSelect: (eventId: string) => void;
};

function TimelinePanel({ timeline, selectedEventId, onPhaseSelect }: TimelinePanelProps) {
  return (
    <section className="sticky top-6 space-y-4 rounded-lg border border-border-subtle bg-bg-surface p-0 shadow-sm h-full flex flex-col overflow-hidden">
      <div className="border-b border-border-subtle px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Phases</h2>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-elegant">
        {timeline.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onPhaseSelect(event.id)}
            className={`w-full rounded-md border px-3 py-2 text-left transition ${selectedEventId === event.id
              ? "border-border-strong bg-state-selected"
              : "border-transparent hover:bg-state-hover"
              }`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-text-primary">{event.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${event.status === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : event.status === "error"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : event.status === "pending"
                      ? "bg-bg-elevated text-text-muted border border-border-subtle"
                      : "bg-bg-elevated text-text-primary border border-border-strong"
                  }`}
              >
                {event.status}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1.5 line-clamp-1">{event.summary}</p>
            {event.systemPrompt && (
              <p className="text-[10px] font-mono text-text-muted/60 mt-1 line-clamp-1">
                {event.systemPrompt.split("\n")[0]}
              </p>
            )}
            {event.status === "running" && (
              <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-bg-elevated">
                <div className="h-full w-full bg-text-muted animate-progress-loader opacity-50" />
              </div>
            )}
          </button>
        ))}
      </div>

    </section>
  );
}

type ToolExplorerPanelProps = {
  tools: McpToolMeta[];
  usedToolNames: Set<string>;
  openToolDialog: (toolName: McpToolMeta) => void;
};

function ToolExplorerPanel({ tools, usedToolNames, openToolDialog }: ToolExplorerPanelProps) {
  return (
    <section className="sticky top-6 space-y-0 rounded-lg border border-border-subtle bg-bg-surface shadow-sm h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2 bg-bg-surface">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Tools</h3>
        <span className="text-[10px] text-text-muted">
          {usedToolNames.size} used
        </span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-elegant p-1">
        <ul className="space-y-0.5">
          {tools.map((tool) => (
            <li key={tool.name}>
              <button
                type="button"
                onClick={() => openToolDialog(tool)}
                className="group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] text-text-secondary transition hover:bg-state-hover hover:text-text-primary"
              >
                <span className="truncate">{tool.label}</span>
                <span className="opacity-0 transition-opacity group-hover:opacity-100">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

type GraphOption = (typeof graphOptions)[number];

type HeaderControlsProps = {
  selectedGraphId: GraphId;
  selectedGraph: GraphOption;
  onSelectGraph: (graphId: GraphId) => void;
  modelProvider: "azure" | "lmstudio";
  onSelectProvider: (provider: "azure" | "lmstudio") => void;
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
};

function HeaderControls({
  selectedGraphId,
  selectedGraph,
  onSelectGraph,
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
}: HeaderControlsProps) {
  const [isGraphMenuOpen, setIsGraphMenuOpen] = useState(false);
  const [isLlmMenuOpen, setIsLlmMenuOpen] = useState(false);
  const [isGraphInfoOpen, setIsGraphInfoOpen] = useState(false);
  const [isLlmInfoOpen, setIsLlmInfoOpen] = useState(false);
  const [detailGraph, setDetailGraph] = useState<GraphOption | null>(null);
  const [detailProvider, setDetailProvider] = useState<"azure" | "lmstudio" | null>(null);
  const graphMenuRef = useRef<HTMLDivElement | null>(null);
  const llmMenuRef = useRef<HTMLDivElement | null>(null);
  const graphDetail = detailGraph ?? selectedGraph;
  const llmDetail = detailProvider ?? modelProvider;
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditingLlm, setIsEditingLlm] = useState(false);
  const [llmConfigFromDb, setLlmConfigFromDb] = useState<any>(null);

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
    fetchLlmConfig();
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
      throw new Error(error.error || 'Failed to save configuration');
    }
  }, [fetchLlmConfig]);

  const handleSaveLMStudio = useCallback(async (config: {
    baseUrl: string;
    model: string;
    apiKey?: string;
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
      throw new Error(error.error || 'Failed to save configuration');
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
    <div className="flex flex-wrap items-center gap-3">
      <div ref={graphMenuRef} className="relative">
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-state-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => {
            setIsGraphMenuOpen((prev) => !prev);
            setIsLlmMenuOpen(false);
          }}
        >
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Graph</span>
          <span>{selectedGraph.name}</span>
          <svg
            className="h-3 w-3 text-text-muted"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isGraphMenuOpen && (
          <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-border-subtle bg-bg-elevated p-1 shadow-xl">
            <p className="px-2 py-1.5 text-[10px] font-medium text-text-muted">Choose graph</p>
            <div className="space-y-0.5">
              {graphOptions.map((graph) => (
                <div
                  key={graph.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectGraph(graph.id);
                      setIsGraphMenuOpen(false);
                    }
                  }}
                  onClick={() => {
                    onSelectGraph(graph.id);
                    setIsGraphMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium transition ${graph.id === selectedGraphId ? "bg-state-selected text-text-primary" : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                    }`}
                >
                  <span>{graph.name}</span>
                  <span className="flex items-center gap-2">
                    {graph.id === selectedGraphId && <span className="text-[10px] text-text-muted">active</span>}
                    <button
                      type="button"
                      className="text-text-muted transition hover:text-text-primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetailGraph(graph);
                        setIsGraphInfoOpen(true);
                        setIsGraphMenuOpen(false);
                      }}
                      aria-label={`View details for ${graph.name}`}
                    >
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="6" cy="6" r="5" />
                        <path d="M6 4.5V6.75" strokeLinecap="round" />
                        <circle cx="6" cy="8.75" r=".25" fill="currentColor" stroke="none" />
                      </svg>
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div ref={llmMenuRef} className="relative">
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-state-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => {
            setIsLlmMenuOpen((prev) => !prev);
            setIsGraphMenuOpen(false);
          }}
        >
          <span className="text-[10px] uppercase tracking-wider text-text-muted">LLM</span>
          <span>{modelProvider === "azure" ? "Azure" : "LM Studio"}</span>
          <svg
            className="h-3 w-3 text-text-muted"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isLlmMenuOpen && (
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border-subtle bg-bg-elevated p-1 shadow-xl">
            <p className="px-2 py-1.5 text-[10px] font-medium text-text-muted">Select provider</p>
            <div className="space-y-0.5">
              {(["azure", "lmstudio"] as const).map((provider) => (
                <div
                  key={provider}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectProvider(provider);
                      setIsLlmMenuOpen(false);
                    }
                  }}
                  onClick={() => {
                    onSelectProvider(provider);
                    setIsLlmMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium transition ${provider === modelProvider ? "bg-state-selected text-text-primary" : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                    }`}
                >
                  <span>{provider === "azure" ? "Azure OpenAI" : "LM Studio (local)"}</span>
                  <span className="flex items-center gap-2">
                    {provider === modelProvider && <span className="text-[10px] text-text-muted">active</span>}
                    <button
                      type="button"
                      className="text-text-muted transition hover:text-text-primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetailProvider(provider);
                        setIsLlmInfoOpen(true);
                        setIsLlmMenuOpen(false);
                      }}
                      aria-label={`View details for ${provider === "azure" ? "Azure OpenAI" : "LM Studio"}`}
                    >
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="6" cy="6" r="5" />
                        <path d="M6 4.5V6.75" strokeLinecap="round" />
                        <circle cx="6" cy="8.75" r=".25" fill="currentColor" stroke="none" />
                      </svg>
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsLlmInfoOpen(true);
                setIsLlmMenuOpen(false);
              }}
              className="mt-2 flex w-full items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-state-hover hover:text-text-primary"
            >
              <svg
                className="h-3 w-3"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="6" cy="6" r="5" />
                <path d="M6 4.5V6.75" strokeLinecap="round" />
                <circle cx="6" cy="8.75" r=".25" fill="currentColor" stroke="none" />
              </svg>
              View details
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface p-1 pr-3 pl-3 transition hover:border-border-strong">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Context</span>
          <button
            type="button"
            onClick={() => {
              if (!auditContextEnabled && !auditContextSummary) {
                onConfigureAuditContext();
                onAuditContextEnabledChange(true);
              } else {
                onAuditContextEnabledChange(!auditContextEnabled);
              }
            }}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${auditContextEnabled ? "bg-text-secondary" : "bg-bg-elevated border border-border-subtle"
              }`}
          >
            <span
              className={`${auditContextEnabled ? "translate-x-3.5" : "translate-x-0.5"
                } inline-block h-3 w-3 transform rounded-full bg-text-primary transition-transform`}
            />
          </button>
        </div>

        <div className="h-4 w-[1px] bg-border-subtle mx-1" />

        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${auditContextEnabled ? "text-text-primary" : "text-text-muted"}`}>
            {auditContextEnabled ? (auditContextSummary ?? "Config needed") : "Off"}
          </span>
          <button
            type="button"
            className="text-text-muted hover:text-text-primary transition"
            onClick={onConfigureAuditContext}
            aria-label="Configure context"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsHistoryOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-state-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <span className="text-[10px] uppercase tracking-wider text-text-muted">View</span>
        <span>History</span>
      </button>

      <AuditHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />

      <Modal
        open={isGraphInfoOpen}
        onClose={() => {
          setIsGraphInfoOpen(false);
          setDetailGraph(null);
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
                  <p className="font-semibold text-text-primary">{phase.label}</p>
                  <p className="text-text-muted">{phase.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>

      <Modal
        open={isLlmInfoOpen}
        onClose={() => {
          setIsLlmInfoOpen(false);
          setDetailProvider(null);
          setIsEditingLlm(false);
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
                  onClick={handleResetConfig}
                  className="px-4 py-2 rounded-md bg-bg-surface border border-border-subtle text-text-secondary hover:bg-state-hover transition text-xs font-medium"
                >
                  Reset to Environment
                </button>
              </div>
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
                  onClick={handleResetConfig}
                  className="px-4 py-2 rounded-md bg-bg-surface border border-border-subtle text-text-secondary hover:bg-state-hover transition text-xs font-medium"
                >
                  Reset to Environment
                </button>
              </div>
            </div>
          )
        ) : (
          // Edit mode
          llmDetail === "azure" ? (
            <AzureConfigForm
              initialConfig={{
                endpoint: llmConfigFromDb?.azure?.endpoint ?? llmInfo?.azure?.endpoint ?? "",
                deployment: llmConfigFromDb?.azure?.deployment ?? llmInfo?.azure?.deployment ?? "",
                model: llmConfigFromDb?.azure?.model ?? llmInfo?.azure?.model ?? "",
                apiVersion: llmConfigFromDb?.azure?.apiVersion ?? llmInfo?.azure?.apiVersion ?? "",
              }}
              onSave={handleSaveAzure}
              onCancel={() => setIsEditingLlm(false)}
            />
          ) : (
            <LMStudioConfigForm
              initialConfig={{
                baseUrl: llmConfigFromDb?.lmstudio?.baseUrl ?? lmStudioBaseUrl,
                model: llmConfigFromDb?.lmstudio?.model ?? lmStudioModel,
              }}
              onSave={handleSaveLMStudio}
              onCancel={() => setIsEditingLlm(false)}
            />
          )
        )}
      </Modal>
    </div>
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
            )}
          </div>
          <pre className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface p-3 text-[12px] leading-relaxed text-text-primary whitespace-pre-wrap break-words scrollbar-elegant">
            {resultText}
          </pre>
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
    </article>
  );
}

export default function HomePage() {
  const [promptFolders, setPromptFolders] = useState<string[]>([]);
  const [selectedPromptFolder, setSelectedPromptFolder] = useState<string>("");
  const [selectedPromptFile, setSelectedPromptFile] = useState<string | null>(null);
  const [promptLoadError, setPromptLoadError] = useState<string | null>(null);
  const [promptFolderLoading, setPromptFolderLoading] = useState(false);
  const [promptContentLoading, setPromptContentLoading] = useState(false);
  const [folderFileMap, setFolderFileMap] = useState<Record<string, PromptFileEntry[]>>({});
  const [folderFileLoading, setFolderFileLoading] = useState<Record<string, boolean>>({});
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set([""]));
  const [isPromptSelectorOpen, setIsPromptSelectorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeFolderPath = selectedPromptFolder;
  const applyDefaultSelectionFor = useCallback(
    (folderPath: string, files: PromptFileEntry[]) => {
      if (selectedPromptFile) {
        return;
      }
      if (!files.length) {
        return;
      }
      setSelectedPromptFile((current) => current ?? files[0].path);
    },
    [selectedPromptFile]
  );
  const loadFolderFiles = useCallback(async (folderPath: string) => {
    setPromptLoadError(null);
    setFolderFileLoading((prev) => ({ ...prev, [folderPath]: true }));
    try {
      const query = folderPath ? `?dir=${encodeURIComponent(folderPath)}` : "";
      const response = await fetch(`/api/prompts/files${query}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }
      const data = (await response.json()) as { files?: PromptFileEntry[] };
      const files = Array.isArray(data?.files) ? data.files : [];
      setFolderFileMap((prev) => ({ ...prev, [folderPath]: files }));
      applyDefaultSelectionFor(folderPath, files);
    } catch (error) {
      setPromptLoadError((error as Error).message || "Unable to load prompt files.");
    } finally {
      setFolderFileLoading((prev) => ({ ...prev, [folderPath]: false }));
    }
  }, [applyDefaultSelectionFor]);
  const toggleFolder = useCallback(
    (folderPath: string) => {
      setOpenFolders((prev) => {
        const next = new Set(prev);
        if (next.has(folderPath)) {
          next.delete(folderPath);
        } else {
          next.add(folderPath);
        }
        return next;
      });
      setSelectedPromptFolder(folderPath);
      if (!folderFileMap[folderPath] && !folderFileLoading[folderPath]) {
        loadFolderFiles(folderPath);
      }
    },
    [folderFileMap, folderFileLoading, loadFolderFiles]
  );
  const promptFolderTree = useMemo<PromptFolderNode[]>(() => {
    const root: PromptFolderNode = { name: "prompts", path: "", children: [] };
    const nodes = new Map<string, PromptFolderNode>([["", root]]);
    for (const dir of promptFolders) {
      if (!dir) continue;
      const segments = dir.split("/").filter(Boolean);
      let parent = root;
      let currentPath = "";
      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        if (!nodes.has(currentPath)) {
          const node: PromptFolderNode = {
            name: segment,
            path: currentPath,
            children: [],
          };
          nodes.set(currentPath, node);
          parent.children.push(node);
        }
        parent = nodes.get(currentPath)!;
      }
    }
    return [root];
  }, [promptFolders]);

  const [selectedGraphId, setSelectedGraphId] = useState(graphOptions[0].id);
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
  const [modelProvider, setModelProvider] = useState<"azure" | "lmstudio">("azure");
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
  const eventStreamRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const promptPanelHeight = 160;

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

  useEffect(() => {
    let isMounted = true;
    setPromptFolderLoading(true);
    setPromptLoadError(null);
    fetch("/api/prompts/dirs")
      .then((res) => res.json())
      .then((data: { dirs?: string[] }) => {
        if (!isMounted) return;
        const dirs = Array.isArray(data?.dirs) ? data.dirs : [];
        setPromptFolders(dirs);
        const initialFolder = dirs[0] ?? "";
        setSelectedPromptFolder(initialFolder);
        setOpenFolders((prev) => {
          const next = new Set(prev);
          next.add(initialFolder);
          return next;
        });
        loadFolderFiles(initialFolder);
      })
      .catch(() => {
        if (!isMounted) return;
        setPromptFolders([]);
        setSelectedPromptFolder("");
        setOpenFolders(new Set([""]));
        setSelectedPromptFile(null);
        setFolderFileMap({});
        setFolderFileLoading({});
        setPromptLoadError("Unable to load prompt folders.");
      })
      .finally(() => {
        if (!isMounted) return;
        setPromptFolderLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [loadFolderFiles]);

  useEffect(() => {
    if (!selectedPromptFile) return;
    setPromptContentLoading(true);
    setPromptLoadError(null);
    fetch(`/api/prompts/file?path=${encodeURIComponent(selectedPromptFile)}`)
      .then((res) => res.json())
      .then((data: { content?: string }) => {
        if (typeof data?.content === "string") {
          setMessageInput(data.content);
        }
      })
      .catch(() => setPromptLoadError("Unable to load prompt content."))
      .finally(() => setPromptContentLoading(false));
  }, [selectedPromptFile]);

  useEffect(() => {
    const stored = window.localStorage.getItem("numezis-llm-selection");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { provider?: string; model?: string };
        if (parsed.provider === "azure" || parsed.provider === "lmstudio") {
          setModelProvider(parsed.provider);
        }
        if (typeof parsed.model === "string") {
          setLmStudioModel(parsed.model);
        }
      } catch {
        // Ignore malformed cache entries.
      }
    }
    setLlmPrefsLoaded(true);
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

  useEffect(() => {
    fetch("/api/env")
      .then((res) => res.json())
      .then((data: { targetDir?: string | null; llm?: LlmEnvInfo }) => {
        setTargetDir(data.targetDir || null);
        setLlmInfo(data.llm ?? null);
        if (!window.localStorage.getItem("numezis-llm-selection")) {
          const defaultProvider =
            data.llm?.defaultProvider === "lmstudio" ? "lmstudio" : "azure";
          setModelProvider(defaultProvider);
          if (defaultProvider === "lmstudio") {
            setLmStudioModel(data.llm?.lmstudio?.model ?? "");
          }
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

  useEffect(() => {
    const payload = {
      enabled: auditContextEnabled,
      context: auditContext,
    };
    window.localStorage.setItem("numezis-audit-context", JSON.stringify(payload));
  }, [auditContext, auditContextEnabled]);

  useEffect(() => {
    setLlmError(null);
  }, [modelProvider, lmStudioModel]);

  const handleCopyPath = useCallback((path: string) => {
    if (!path) return;
    navigator.clipboard.writeText(path).then(() => {
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
      if (chunk.type === "update" || chunk.type === "final") {
        setTimeline(chunk.payload.timeline);
        setEventStream(chunk.payload.eventStream);
        if (chunk.payload.outputs) {
          setOutputs(chunk.payload.outputs);
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

  const selectedGraph =
    graphOptions.find((graph) => graph.id === selectedGraphId) ?? graphOptions[0];
  const graphToolNames = selectedGraph.toolNames ?? [];
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
    return selectedGraph.phases;
  }, [timeline, selectedGraph]);

  const nodePromptOverrides = useMemo(() => {
    if (!timeline.length) return new Map<string, string>();
    return new Map(
      timeline
        .filter((entry) => typeof entry.systemPrompt === "string")
        .map((entry) => [entry.id, entry.systemPrompt ?? ""])
    );
  }, [timeline]);

  const displayNodePrompts = useMemo(
    () =>
      selectedGraph.nodePrompts.map((nodePrompt) => ({
        ...nodePrompt,
        prompt: nodePromptOverrides.get(nodePrompt.id) ?? nodePrompt.prompt,
      })),
    [selectedGraph.nodePrompts, nodePromptOverrides]
  );

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
          graph: selectedGraphId,
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
        handleSendMessage();
      }
    }
    // Shift+Enter for new line (default behavior)
  };

  // Global keyboard shortcut for opening prompt selector (Cmd+K / Ctrl+K)
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPromptSelectorOpen(true);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Auto-expand textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [messageInput]);

  // Handle prompt selection from modal
  const handleSelectPrompt = async (path: string) => {
    setPromptContentLoading(true);
    setPromptLoadError("");
    try {
      const res = await fetch(`/api/prompts/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        throw new Error(`Failed to load prompt: ${res.statusText}`);
      }
      const data = await res.json();
      setMessageInput(data.content || "");
    } catch (err) {
      setPromptLoadError(err instanceof Error ? err.message : "Failed to load prompt");
    } finally {
      setPromptContentLoading(false);
    }
  };

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
    <div className="h-screen overflow-hidden bg-bg-app text-text-primary font-sans antialiased selection:bg-state-selected selection:text-text-primary">
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4 px-4 py-4">
        <header className="rounded-lg border border-border-subtle bg-bg-surface p-2 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold tracking-tight px-2 text-text-primary">Numezis Coder</h1>
              {targetPathEntry && (
                <div className="group relative flex items-center">
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center rounded-md text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                    onClick={() => handleCopyPath(targetPathEntry.value)}
                    aria-label="Copy repo path"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </button>
                  <div className="pointer-events-none absolute left-full ml-2 hidden w-max max-w-xs rounded-md border border-border-strong bg-bg-elevated px-2 py-1 text-[10px] text-text-primary shadow-xl backdrop-blur-sm group-hover:block z-50">
                    <p className="font-mono">
                      {copiedPath === targetPathEntry.value ? "Copied!" : targetPathEntry.value}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <HeaderControls
              selectedGraphId={selectedGraphId}
              selectedGraph={selectedGraph}
              onSelectGraph={setSelectedGraphId}
              modelProvider={modelProvider}
              onSelectProvider={setModelProvider}
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
            />
          </div>
        </header>

        <div className="grid grid-cols-[300px_minmax(0,1fr)_360px] gap-4 min-h-0">
          <div className="min-h-0">
            <TimelinePanel
              timeline={activeTimeline}
              selectedEventId={selectedEventId}
              onPhaseSelect={handlePhaseClick}
            />
          </div>

          <div className="min-h-0">
            <main className="flex h-full min-h-0 w-full flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-0 shadow-sm overflow-hidden">
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
                    style={{ paddingBottom: promptPanelHeight }}
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

                {/* Compact input area - VS Code style */}
                <div className="sticky bottom-0 border-t border-border-subtle bg-bg-elevated px-4 py-3">
                  <div className="flex items-end gap-2">
                    {/* Prompt selector button */}
                    <button
                      type="button"
                      onClick={() => setIsPromptSelectorOpen(true)}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                      title="Select prompt (⌘K)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="h-4 w-4"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>

                    {/* Auto-expanding textarea */}
                    <textarea
                      ref={textareaRef}
                      value={messageInput}
                      onChange={(event) => setMessageInput(event.target.value)}
                      onKeyDown={handleMessageInputKeyDown}
                      placeholder="Type your message..."
                      rows={1}
                      className="flex-1 resize-none rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-border-strong scrollbar-elegant"
                      style={{
                        minHeight: '36px',
                        maxHeight: '120px',
                        height: 'auto'
                      }}
                    />

                    {/* Inline send button */}
                    <button
                      type="button"
                      onClick={loading ? handleStop : handleSendMessage}
                      disabled={!loading && !canSendMessage}
                      className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-md bg-state-selected px-4 text-sm font-medium text-text-primary transition hover:bg-state-active disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-primary border-t-transparent" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-4 w-4"
                          >
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                          </svg>
                          <span>Send</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Error message */}
                  {(promptLoadError || promptContentLoading) && (
                    <p className="mt-2 text-xs text-rose-400">
                      {promptLoadError || "Applying prompt content…"}
                    </p>
                  )}
                </div>
              </div>
            </main>
          </div>

          <div className="min-h-0">
            <ToolExplorerPanel
              tools={graphTools}
              usedToolNames={usedToolNames}
              openToolDialog={openToolDialog}
            />
          </div>
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
                  {selectedEvent.thoughtLog.map((thought, index) => (
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
            This context is appended to every audit phase prompt and logged in the activity stream.
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

      <PromptSelectorModal
        isOpen={isPromptSelectorOpen}
        onClose={() => setIsPromptSelectorOpen(false)}
        promptFolders={promptFolderTree}
        onSelectPrompt={handleSelectPrompt}
      />
    </div>
  );
}
