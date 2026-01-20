"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import type { McpToolMeta } from "../src/tools/mcpToolMetadata";
import type {
  AgentEvent,
  AgentWorkflowResult,
  AgentWorkflowUpdate,
  TimelineEvent,
} from "../src/agentRunner";
import { auditPrompts } from "../src/shared/auditPrompts";
import { graphOptions } from "../src/shared/graphCatalog";

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
  system: "border-slate-700 bg-slate-900/80 text-slate-300",
  user: "border-cyan-500/60 bg-cyan-500/10 text-cyan-200",
  assistant: "border-slate-600 bg-slate-900/60 text-slate-100",
  tool: "border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
};

const eventBadgeLabel: Record<AgentEventKind, string> = {
  system: "System",
  user: "User",
  assistant: "Agent",
  tool: "Tool",
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

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

function Modal({ open, onClose, title, subtitle, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-[6px]"
    >
      <div className="relative w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/10 bg-slate-950/95 p-6 shadow-[0_30px_60px_rgba(2,6,23,0.75)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">
                {title}
              </p>
            )}
            {subtitle && <h3 className="text-3xl font-semibold text-white">{subtitle}</h3>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-white"
          >
            Close
          </button>
        </div>
        <div className="mt-6 space-y-6">{children}</div>
      </div>
    </div>
  );
}

type TimelinePanelProps = {
  timeline: TimelineEvent[];
  selectedEventId: string | null;
  onPhaseSelect: (eventId: string) => void;
};

function TimelinePanel({ timeline, selectedEventId, onPhaseSelect }: TimelinePanelProps) {
  return (
    <section className="sticky top-6 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg h-full flex flex-col overflow-hidden">
      <h2 className="text-lg font-semibold">Phases</h2>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {timeline.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onPhaseSelect(event.id)}
            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
              selectedEventId === event.id
                ? "border-cyan-400 bg-slate-950/80"
                : "border-slate-800 bg-slate-950/40"
            }`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-100">{event.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  event.status === "success"
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40"
                    : event.status === "error"
                    ? "bg-rose-500/10 text-rose-300 border border-rose-500/40"
                    : event.status === "pending"
                    ? "bg-slate-600/20 text-slate-300 border border-slate-500/40"
                    : "bg-sky-400/10 text-sky-200 border border-sky-400/30"
                }`}
              >
                {event.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">{event.summary}</p>
            {event.systemPrompt && (
              <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">
                Preview: {event.systemPrompt.split("\n")[0]}
              </p>
            )}
            {event.status === "running" && (
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                <div className="h-full w-full bg-gradient-to-r from-cyan-400 via-slate-600 to-transparent animate-progress-loader" />
              </div>
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        Click a phase card to inspect the prompt, tool access list, and thought log.
      </p>
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
    <section className="sticky top-6 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-lg h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
        <span>Tool explorer</span>
        <span>
          {usedToolNames.size} tool{usedToolNames.size === 1 ? "" : "s"} used
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {tools.map((tool) => (
          <button
            key={tool.name}
            type="button"
            onClick={() => openToolDialog(tool)}
            className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-left text-sm font-semibold text-white transition hover:border-cyan-400"
          >
            <span className="text-[13px] leading-tight">{tool.label}</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{tool.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

type GraphOption = (typeof graphOptions)[number];

type HeaderControlsProps = {
  selectedGraphId: string;
  selectedGraph: GraphOption;
  onSelectGraph: (graphId: string) => void;
  modelProvider: "azure" | "lmstudio";
  onSelectProvider: (provider: "azure" | "lmstudio") => void;
  azureConfigured: boolean;
  llmInfo: LlmEnvInfo | null;
  lmStudioBaseUrl: string;
  lmStudioModel: string;
  onLmStudioModelChange: (value: string) => void;
  llmError: string | null;
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
          className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-white transition hover:border-cyan-400"
          onClick={() => {
            setIsGraphMenuOpen((prev) => !prev);
            setIsLlmMenuOpen(false);
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Graph</span>
          <span>{selectedGraph.name}</span>
          <svg
            className="h-3 w-3 text-slate-400"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isGraphMenuOpen && (
          <div className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-slate-800 bg-slate-950/95 p-2 shadow-xl">
            <p className="px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-500">Choose graph</p>
            <div className="mt-1 space-y-1">
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
                  className={`flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold transition ${
                    graph.id === selectedGraphId ? "bg-cyan-500/10 text-cyan-200" : "text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <span>{graph.name}</span>
                  <span className="flex items-center gap-2">
                    {graph.id === selectedGraphId && <span className="text-xs text-cyan-300">active</span>}
                    <button
                      type="button"
                      className="text-slate-400 transition hover:text-cyan-400"
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
          className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-white transition hover:border-cyan-400"
          onClick={() => {
            setIsLlmMenuOpen((prev) => !prev);
            setIsGraphMenuOpen(false);
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">LLM</span>
          <span>{modelProvider === "azure" ? "Azure" : "LM Studio"}</span>
          <svg
            className="h-3 w-3 text-slate-400"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isLlmMenuOpen && (
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-slate-800 bg-slate-950/95 p-2 shadow-xl">
            <p className="px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-500">Select provider</p>
            <div className="mt-1 space-y-1">
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
                  className={`flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold transition ${
                    provider === modelProvider ? "bg-cyan-500/10 text-cyan-200" : "text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <span>{provider === "azure" ? "Azure OpenAI" : "LM Studio (local)"}</span>
                  <span className="flex items-center gap-2">
                    {provider === modelProvider && <span className="text-xs text-cyan-300">active</span>}
                    <button
                      type="button"
                      className="text-slate-400 transition hover:text-cyan-400"
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
              className="mt-2 flex w-full items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-2 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-cyan-400"
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

      <Modal
        open={isGraphInfoOpen}
        onClose={() => {
          setIsGraphInfoOpen(false);
          setDetailGraph(null);
        }}
        title="Graph details"
        subtitle={(detailGraph ?? selectedGraph).name}
      >
        <div className="space-y-4 text-sm text-slate-300">
          <p>{graphDetail.description}</p>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Phases</p>
            <ul className="space-y-2">
              {graphDetail.phases.map((phase) => (
                <li key={phase.id} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[12px]">
                  <p className="font-semibold text-white">{phase.label}</p>
                  <p className="text-slate-400">{phase.summary}</p>
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
        }}
        title="LLM details"
        subtitle={llmDetail === "azure" ? "Azure OpenAI" : "LM Studio (local)"}
      >
        {llmDetail === "azure" ? (
          <div className="space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Azure OpenAI</p>
              <p className="mt-2 text-white">{azureConfigured ? "Configured" : "Missing credentials"}</p>
              <p className="mt-1 text-xs text-slate-400">Endpoint: {llmInfo?.azure?.endpoint ?? "Not set"}</p>
              <p className="mt-1 text-xs text-slate-400">Deployment: {llmInfo?.azure?.deployment ?? "Not set"}</p>
              <p className="mt-1 text-xs text-slate-400">Model: {llmInfo?.azure?.model ?? "Not set"}</p>
              <p className="mt-1 text-xs text-slate-400">API version: {llmInfo?.azure?.apiVersion ?? "Not set"}</p>
            </div>
            {llmError && <p className="text-xs text-rose-300">{llmError}</p>}
          </div>
        ) : (
          <div className="space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">LM Studio</p>
              <p className="mt-2 text-white">Base URL: {lmStudioBaseUrl}</p>
              <label className="mt-3 block text-[11px] uppercase tracking-[0.3em] text-slate-500">Model ID</label>
              <input
                type="text"
                className="mt-1 w-full rounded-full border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-cyan-400"
                placeholder="LM Studio model ID"
                value={lmStudioModel}
                onChange={(event) => onLmStudioModelChange(event.target.value)}
              />
            </div>
            {llmError && <p className="text-xs text-rose-300">{llmError}</p>}
          </div>
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
  const resultText = event.content?.trim() || "Awaiting agent output...";
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
    } catch {}
    return null;
  })();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
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
  const collapsedPreview =
    firstMeaningfulLine.length > 200 ? `${firstMeaningfulLine.slice(0, 200)}…` : firstMeaningfulLine;
  const toggleExpanded = () => setIsExpanded((prev) => !prev);
  const badgeClass = eventBadgeStyles[event.kind];
  const badgeLabel = eventBadgeLabel[event.kind];
  const handleClick = (event: MouseEvent<HTMLArticleElement>) => {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    toggleExpanded();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLArticleElement>) => {
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
      className={`group cursor-pointer rounded-2xl border border-slate-800 bg-slate-950/60 text-slate-100 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
        isToolEvent ? "shadow-emerald-800/30 hover:border-emerald-400" : "shadow-black/20 hover:border-cyan-400"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${badgeClass}`}>
              {badgeLabel}
            </span>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
              {event.phaseLabel ?? (isToolEvent ? "Tool call" : "Agent log")}
            </p>
          </div>
          <p className="text-sm font-semibold text-white truncate">{titleText}</p>
          <p className="text-xs text-slate-400 truncate">{collapsedPreview || "Awaiting agent output..."}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-[10px] uppercase tracking-[0.3em] text-slate-500">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded();
            }}
            aria-expanded={isExpanded}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-950/80 text-slate-200 transition group-hover:border-white/70"
          >
            <span className="sr-only">{isExpanded ? "Collapse details" : "Expand details"}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              className={`h-4 w-4 transform transition ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
            </svg>
          </button>
          <span>{formatTimestamp(event.timestamp)}</span>
        </div>
      </div>

      {agentMarkdown && (
        <section className="space-y-2 border-t border-slate-800 px-3 pb-3 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Markdown</p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleCopyMarkdown();
              }}
              className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300 transition hover:border-slate-500"
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
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-[13px] leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
            {agentMarkdown}
          </div>
        </section>
      )}
      <div className={!isExpanded ? "hidden" : "grid gap-3 border-t border-slate-800 px-3 pb-4 pt-2"} role="region">
        {event.name && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
            <span className="font-semibold text-white">Tool</span>
            <span>{event.name}</span>
            <span className="text-slate-500">{toolMeta ? "registered" : "external"}</span>
          </div>
        )}
        {isToolEvent && formattedArgs && (
          <section>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Arguments</p>
            <pre className="mt-2 max-h-40 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-[12px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words">
              {formattedArgs}
            </pre>
          </section>
        )}
        <section>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
            Result{isToolEvent ? "" : " / Thought"}
          </p>
          <pre className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-[12px] leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
            {resultText}
          </pre>
        </section>
        {isToolEvent && toolMeta && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openToolDialog(toolMeta)}
              className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-300 transition hover:border-cyan-400"
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
  const [selectedPromptId, setSelectedPromptId] = useState(auditPrompts[0].id);
  const [selectedGraphId, setSelectedGraphId] = useState(graphOptions[0].id);
  const [targetDir, setTargetDir] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [eventStream, setEventStream] = useState<AgentEvent[]>(() => [createSystemEvent()]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<AgentWorkflowResult["outputs"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
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
  const promptPanelHeight = 260;

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
    setLlmError(null);
  }, [modelProvider, lmStudioModel]);

  const handleCopyPath = useCallback((path: string) => {
    if (!path) return;
    navigator.clipboard.writeText(path).then(() => {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    });
  }, []);

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

  const selectedAuditPrompt =
    auditPrompts.find((prompt) => prompt.id === selectedPromptId) ?? auditPrompts[0];
  const selectedGraph =
    graphOptions.find((graph) => graph.id === selectedGraphId) ?? graphOptions[0];
  const graphToolNames = selectedGraph.toolNames ?? [];
  useEffect(() => {
    if (selectedGraph.id === "audit") {
      setMessageInput(selectedAuditPrompt.prompt);
    }
  }, [selectedAuditPrompt, selectedGraph.id]);
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
    setLoading(true);
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          graph: selectedGraphId,
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
    }
  };

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
  const visibleEventStream = useMemo(() => {
    const hasNonSystemEvent = eventStream.some((event) => event.kind !== "system");
    if (!hasNonSystemEvent) {
      return [];
    }
    return eventStream.filter((event) => event.kind !== "system");
  }, [eventStream]);
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
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4 px-6 py-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Numezis Coder</h1>
              {targetPathEntry && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{targetPathEntry.label}</span>
                    <span className="font-mono text-[11px] text-cyan-200">{targetPathEntry.value}</span>
                    <button
                      type="button"
                      className="rounded-full border border-slate-800 bg-slate-950/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-400 transition hover:border-cyan-400"
                      onClick={() => handleCopyPath(targetPathEntry.value)}
                    >
                      {copiedPath === targetPathEntry.value ? "Copied" : "Copy"}
                    </button>
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
            <main className="flex h-full min-h-0 w-full flex-col gap-4 rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-950/90 p-6 shadow-[0_25px_50px_rgba(2,6,23,0.55)] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Activity log</h2>
                </div>
              </div>

              <div className="relative flex flex-1 flex-col gap-4 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <div
                    ref={eventStreamRef}
                    className="h-full max-h-full min-h-0 space-y-4 overflow-y-auto pr-2"
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
                      <div className="rounded-3xl border border-dashed border-slate-700 bg-gradient-to-r from-slate-900/60 via-slate-800/70 to-slate-900/40 p-4 text-sm text-slate-400 shadow-[0_0_40px_rgba(14,116,144,0.4)]">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)] animate-pulse" />
                            <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-cyan-300">
                              Agent running...
                            </p>
                          </div>
                          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-300">
                            Tracking phases and tools · final summary incoming
                          </p>
                          <div className="h-[6px] w-full overflow-hidden rounded-full bg-slate-900">
                            <div className="h-full w-full bg-gradient-to-r from-cyan-500 to-slate-900 animate-light-pulse" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-4 z-10 px-0">
                  <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.65)] backdrop-blur relative">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label
                          htmlFor="prompt-select"
                          className="text-[11px] uppercase tracking-[0.3em] text-slate-500"
                        >
                          Select a prompt
                        </label>
                        <select
                          id="prompt-select"
                          className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-400"
                          value={selectedPromptId}
                          onChange={(event) => setSelectedPromptId(event.target.value)}
                        >
                          {auditPrompts.map((prompt) => (
                            <option key={prompt.id} value={prompt.id}>
                              {prompt.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-slate-400">{selectedAuditPrompt.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                      <textarea
                        className="w-full flex-1 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm font-medium text-white outline-none transition focus:border-cyan-400 focus:ring-0"
                        rows={3}
                        value={messageInput}
                        onChange={(event) => setMessageInput(event.target.value)}
                        placeholder="Tell the agent what you want to investigate..."
                      />
                      <button
                        type="button"
                        className="inline-flex h-11 min-w-[160px] items-center justify-center rounded-2xl border border-cyan-500/60 bg-gradient-to-r from-cyan-500/30 to-slate-900/40 px-5 text-sm font-semibold text-white transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={handleSendMessage}
                        disabled={loading}
                      >
                        {loading ? "Sending…" : "Send message"}
                      </button>
                    </div>
                  </div>
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
              <p className="text-xs text-slate-400">{selectedEvent.details}</p>
            )}
            <section className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Graph prompts</p>
              <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
                {selectedGraph.nodePrompts.map((nodePrompt) => {
                  const isActive =
                    nodePrompt.id === selectedEvent.id ||
                    nodePrompt.id.startsWith(`${selectedEvent.id}_`);
                  return (
                    <div
                      key={nodePrompt.id}
                      className={`rounded-2xl border p-3 ${
                        isActive
                          ? "border-cyan-400/60 bg-cyan-500/10"
                          : "border-slate-800 bg-slate-950/50"
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                        {nodePrompt.label}
                      </p>
                      <pre className="mt-2 text-[12px] leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
                        {nodePrompt.prompt || "Pending prompt..."}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Tool access</p>
                <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
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
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left text-[12px] text-slate-200 transition hover:border-cyan-400"
                    >
                      <span className="font-semibold text-white">{tool.label}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.3em] ${
                          used ? "border-emerald-500/40 text-emerald-200" : "border-slate-600 text-slate-400"
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
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Thought log</p>
              {selectedEvent.thoughtLog?.length ? (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {selectedEvent.thoughtLog.map((thought, index) => (
                    <li
                      key={index}
                      className="rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] leading-5 text-slate-200"
                    >
                      {thought}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Awaiting agent trace...</p>
              )}
            </section>
          </div>
        )}
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
            <p className="text-sm text-slate-300">{selectedTool.description}</p>
            {selectedTool.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                {selectedTool.categories.map((category) => (
                  <span key={category} className="rounded-full border border-slate-800 px-3 py-1">
                    {category}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-[12px] text-slate-300">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Source</p>
              <pre className="max-h-64 overflow-y-auto rounded-xl bg-slate-950/70 p-3 text-[11px] leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
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
