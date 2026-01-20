"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import type { McpToolMeta } from "../src/tools/mcpToolMetadata";
import type {
  AgentEvent,
  AgentWorkflowResult,
  AgentWorkflowUpdate,
  TimelineEvent,
} from "../src/agentRunner";

const uiPhaseDefinitions = [
  {
    id: "phase1",
    label: "Phase 1 — Map",
    summary: "Generate a repo map + meta data.",
    description: "Prefer repo metrics, repo structure, and targeted search to keep the survey light.",
    systemPrompt: "You are Phase1MapperAgent.",
  },
  {
    id: "phase2",
    label: "Phase 2 — Audit",
    summary: "Produce focused findings within a limited scope.",
    description: "Use git diffs, search, and range reads to generate evidence tied to recent activity files.",
    systemPrompt: "You are Phase2AuditorAgent.",
  },
  {
    id: "phase3",
    label: "Phase 3 — Plan",
    summary: "Turn findings into actionable tickets.",
    description: "Prioritize by impact · effort and create acceptance criteria for each task.",
    systemPrompt: "You are Phase3PlannerAgent.",
  },
  {
    id: "phase4",
    label: "Phase 4 — Report",
    summary: "Craft a final markdown report.",
    description: "Combine executive summary, repo map, findings, plan, and annexes into a tidy report.",
    systemPrompt: "You are Phase4ReporterAgent.",
  },
];

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
      <h2 className="text-lg font-semibold">Timeline</h2>
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

export default function HomePage() {
  const [message, setMessage] = useState("");
  const [eventStream, setEventStream] = useState<AgentEvent[]>(() => [createSystemEvent()]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<AgentWorkflowResult["outputs"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<McpToolMeta[]>([]);
  const [toolCodeCache, setToolCodeCache] = useState<Record<string, string>>({});
  const [toolLoadingMap, setToolLoadingMap] = useState<Record<string, boolean>>({});
  const [selectedTool, setSelectedTool] = useState<McpToolMeta | null>(null);
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const eventStreamRef = useRef<HTMLDivElement | null>(null);
  const [expandedEventArgs, setExpandedEventArgs] = useState<Set<string>>(() => new Set());

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

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const userEvent: AgentEvent = {
      id: `user-${Date.now()}`,
      phaseId: "user",
      phaseLabel: "User request",
      kind: "user",
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setEventStream([createSystemEvent(), userEvent]);
    setMessage("");
    setOutputs(null);
    setTimeline([]);
    setSelectedEventId("phase1");
    setLoading(true);
    setExpandedEventArgs(new Set());
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
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

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
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
  const outputChips = useMemo(() => {
    const chips: { title: string; value: string }[] = [];
    if (outputs) {
      chips.push({ title: "Meta keys", value: Object.keys(outputs.meta).join(", ") || "n/a" });
      chips.push({
        title: "Findings",
        value: outputs.findings.length ? `${outputs.findings.length}` : "0",
      });
      chips.push({ title: "Tasks", value: outputs.tasks.length ? `${outputs.tasks.length}` : "0" });
    }
    return chips;
  }, [outputs]);
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

  const placeholderTimeline: TimelineEvent[] = uiPhaseDefinitions.map((phase, index) => ({
    id: phase.id,
    label: phase.label,
    status: index === 0 ? "running" : "pending",
    summary: phase.summary,
    details: phase.description,
    systemPrompt: phase.systemPrompt,
    thoughtLog: [],
  }));

  const activeTimeline = timeline.length ? timeline : placeholderTimeline;
  const activePhase = activeTimeline.find((entry) => entry.status === "running");
  const completedSteps = activeTimeline.filter((entry) => entry.status === "success").length;
  const progressPercent =
    activeTimeline.length > 0
      ? ((completedSteps + (activePhase ? 0.5 : 0)) / activeTimeline.length) * 100
      : 0;
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen grid-rows-[auto_1fr] gap-4 px-6 py-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Numezis Coder</h1>
            </div>
            <div className="text-right text-xs text-slate-400">
              Active step:
              <span className="ml-1 font-semibold text-white">{activePhase?.label ?? "Idle"}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-slate-400 to-cyan-400 transition-all duration-500"
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-cyan-300 sm:whitespace-nowrap">
              {Math.round(progressPercent)}% complete
            </span>
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
                <h2 className="text-xl font-semibold">Event stream</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  {outputChips.map((chip) => (
                    <div key={chip.title} className="rounded-full border border-slate-800 bg-white/5 px-3 py-1">
                      <span className="block text-[10px] uppercase text-slate-500">{chip.title}</span>
                      <span className="text-sm text-white">{chip.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                <div ref={eventStreamRef} className="h-full min-h-0 space-y-4 overflow-y-auto pr-2">
                  {eventStream.map((event) => {
                    const toolMeta = event.name ? toolLookup.get(event.name) : undefined;
                    const isToolEvent = event.kind === "tool";
                    const isExpanded = expandedEventArgs.has(event.id);
                    return (
                      <article
                        key={event.id}
                        className={`rounded-2xl border p-4 text-sm text-slate-100 shadow-inner transition ${
                          isToolEvent
                            ? "border-emerald-500/40 bg-emerald-950/60 hover:border-emerald-400"
                            : "border-slate-800 bg-slate-950/60 hover:border-cyan-400"
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
                          <span className={`rounded-full border px-3 py-1 font-semibold ${eventBadgeStyles[event.kind]}`}>
                            {eventBadgeLabel[event.kind]}
                          </span>
                          <span className="text-[10px] text-slate-500">{formatTimestamp(event.timestamp)}</span>
                        </div>
                        <div
                          className={`overflow-hidden transition-all ${
                            isExpanded ? "max-h-[480px]" : "max-h-24"
                          }`}
                        >
                          <p
                            className={`text-sm leading-6 text-slate-200 transition ${
                              isExpanded ? "" : "line-clamp-4"
                            }`}
                          >
                            {event.content}
                          </p>
                          {isExpanded && event.toolArgs && (
                            <pre className="mt-3 max-h-40 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
                              {event.toolArgs}
                            </pre>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEventArgs((prev) => {
                              const next = new Set(prev);
                              if (next.has(event.id)) {
                                next.delete(event.id);
                              } else {
                                next.add(event.id);
                              }
                              return next;
                            })
                          }
                          aria-expanded={isExpanded}
                          className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 transition hover:text-white"
                        >
                          {isExpanded ? "Collapse" : "Expand"}
                        </button>
                        {event.kind === "tool" && event.name && (
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-100">Tool:</span>
                            <span>{event.name}</span>
                            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                              {toolMeta ? "known" : "external"}
                            </span>
                            {toolMeta && (
                              <button
                                type="button"
                                onClick={() => openToolDialog(toolMeta)}
                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-300 transition hover:border-cyan-400"
                              >
                                View tool details
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {loading && (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-400">
                      Agent running… tracking phases and tools.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 shadow-[0_12px_30px_rgba(2,6,23,0.6)]">
                  <textarea
                    className="flex-1 rounded-2xl bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:ring-0"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask for follow-up changes..."
                    rows={1}
                  />
                  <button
                    type="button"
                    className="rounded-full border border-slate-700 bg-slate-900 p-3 text-slate-200 transition hover:border-cyan-400 disabled:opacity-40"
                    onClick={sendMessage}
                    disabled={loading}
                  >
                    <span className="sr-only">Send message</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Press Enter to send · Shift+Enter for newline.
                </p>
              </div>
            </main>
          </div>

          <div className="min-h-0">
            <ToolExplorerPanel
              tools={tools}
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
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">System prompt</p>
              <pre className="max-h-48 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-[12px] leading-relaxed text-slate-100">
                {selectedEvent.systemPrompt ?? "Pending prompt..."}
              </pre>
            </section>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Tool access</p>
                <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                  {selectedEvent.status}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {tools.map((tool) => {
                  const used = usedToolNames.has(tool.name);
                  return (
                    <button
                      key={tool.name}
                      type="button"
                      onClick={() => openToolDialog(tool)}
                      className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-left transition hover:border-cyan-400"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">{tool.label}</p>
                          <p className="text-[11px] text-slate-400">{tool.description}</p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] ${
                            used ? "border-emerald-500/40 text-emerald-200" : "border-slate-600 text-slate-400"
                          }`}
                        >
                          {used ? "used" : "available"}
                        </span>
                      </div>
                      {tool.categories.length > 0 && (
                        <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-slate-500">
                          {tool.categories.join(" · ")}
                        </p>
                      )}
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
              <pre className="max-h-64 overflow-y-auto rounded-xl bg-slate-950/70 p-3 text-[11px] leading-relaxed text-slate-100">
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
