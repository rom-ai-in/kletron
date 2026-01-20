"use client";

import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import type { McpToolMeta } from "../src/tools/mcpToolMetadata";
import type { AgentWorkflowResult, TimelineEvent } from "../src/agentRunner";

type ChatEntry = {
  role: "user" | "agent" | "system";
  text: string;
};

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

export default function HomePage() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatEntry[]>([
    {
      role: "system",
      text: "Cursor-mode ready. Ask anything and watch the phases execute.",
    },
  ]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<AgentWorkflowResult["outputs"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<McpToolMeta[]>([]);
  const [selectedTool, setSelectedTool] = useState<McpToolMeta | null>(null);
  const [toolCode, setToolCode] = useState("");
  const [toolLoading, setToolLoading] = useState(false);

  useEffect(() => {
    fetch("/api/tools/list")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTools(data);
          setSelectedTool(data[0] ?? null);
        }
      })
      .catch(() => setTools([]));
  }, []);

  useEffect(() => {
    if (!selectedTool) {
      setToolCode("");
      return;
    }
    setToolLoading(true);
    fetch(`/api/tools/${selectedTool.name}`)
      .then((res) => res.json())
      .then((data) => {
        setToolCode(data.code ?? "// Source unavailable.");
      })
      .catch(() => setToolCode("// Unable to load tool code."))
      .finally(() => setToolLoading(false));
  }, [selectedTool]);

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setChat((prev) => [...prev, { role: "user", text: trimmed }]);
    setMessage("");
    setOutputs(null);
    setTimeline([]);
    setSelectedEventId("phase1");
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data: AgentWorkflowResult | { error: string } = await response.json();
      if ("error" in data) {
        setChat((prev) => [...prev, { role: "agent", text: `Agent failed: ${data.error}` }]);
      } else {
        setTimeline(data.timeline);
        setOutputs(data.outputs);
        setChat((prev) => [...prev, { role: "agent", text: data.conclusion }]);
        setSelectedEventId(data.timeline[0]?.id ?? null);
      }
    } catch (error) {
      setChat((prev) => [
        ...prev,
        { role: "agent", text: `Agent error: ${(error as Error).message}` },
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

  const outputChips = useMemo(() => {
    if (!outputs) return [];
    return [
      { title: "Meta keys", value: Object.keys(outputs.meta).join(", ") || "n/a" },
      { title: "Findings", value: outputs.findings.length ? `${outputs.findings.length}` : "0" },
      { title: "Tasks", value: outputs.tasks.length ? `${outputs.tasks.length}` : "0" },
    ];
  }, [outputs]);

  const placeholderTimeline: TimelineEvent[] = uiPhaseDefinitions.map((phase, index) => ({
    id: phase.id,
    label: phase.label,
    status: index === 0 ? "running" : "pending",
    summary: phase.summary,
    details: phase.description,
    systemPrompt: phase.systemPrompt,
    thoughtLog: [],
  }));

  const activeTimeline = timeline.length ? timeline : loading ? placeholderTimeline : [];
  const activePhase = activeTimeline.find((entry) => entry.status === "running");
  const completedSteps = activeTimeline.filter((entry) => entry.status === "success").length;
  const progressPercent =
    activeTimeline.length > 0
      ? ((completedSteps + (activePhase ? 0.5 : 0)) / activeTimeline.length) * 100
      : 0;
  const selectedEvent =
    activeTimeline.find((entry) => entry.id === selectedEventId) ?? activeTimeline[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">LangGraph control center</p>
              <h1 className="text-3xl font-semibold">Numezis Cursor Flow</h1>
            </div>
            <div className="text-right text-xs text-slate-400">
              Active step:
              <span className="ml-1 font-semibold text-white">{activePhase?.label ?? "Idle"}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-slate-400 to-cyan-400 transition-all duration-500"
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-cyan-300">
              {Math.round(progressPercent)}% complete
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
            <h2 className="text-lg font-semibold">Timeline</h2>
            <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
              {activeTimeline.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-3 text-sm text-slate-500">
                  Send a request to start tracking the phases. Progress, prompts, and thoughts appear here.
                </div>
              ) : (
                activeTimeline.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
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
                ))
              )}
            </div>
            {selectedEvent && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
                <details open className="group">
                  <summary className="cursor-pointer text-sm font-semibold text-white">
                    System prompt
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-slate-300">
                    {selectedEvent.systemPrompt ?? "Pending prompt..."}
                  </pre>
                </details>
                <details className="group mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-white">
                    Thought log
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto text-[11px] text-slate-400">
                    {selectedEvent.thoughtLog?.length
                      ? selectedEvent.thoughtLog.map((thought, index) => (
                          <li
                            key={index}
                            className="rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-1"
                          >
                            {thought}
                          </li>
                        ))
                      : "Awaiting agent trace..."}
                  </ul>
                </details>
              </div>
            )}
          </section>

          <main className="flex flex-col rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/50 to-slate-950/90 p-6 shadow-[0_25px_50px_rgba(2,6,23,0.55)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Chat</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                {outputChips.map((chip) => (
                  <div key={chip.title} className="rounded-full border border-slate-800 bg-white/5 px-3 py-1">
                    <span className="block text-[10px] uppercase text-slate-500">{chip.title}</span>
                    <span className="text-sm text-white">{chip.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto pr-2">
              {chat.map((entry, index) => (
                <div
                  key={`${entry.role}-${index}`}
                  className={`max-w-[75%] rounded-2xl border p-3 text-sm leading-6 ${
                    entry.role === "user"
                      ? "self-end rounded-bl-[20px] border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                      : "self-start rounded-br-[20px] border-slate-800 bg-slate-950/50 text-slate-200"
                  }`}
                >
                  {entry.text}
                </div>
              ))}
              {loading && (
                <div className="max-w-[70%] rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-400 animate-pulse">
                  Agent running… tracking phases and tools.
                </div>
              )}
            </div>
            <div className="sticky bottom-0 z-10 mt-4">
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
                Sticky composer with Cursor cues while your agent is processing.
              </p>
            </div>
          </main>

          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-white">Tool explorer</h2>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className={`group relative rounded-2xl border p-4 shadow-xl transition hover:-translate-y-1 hover:border-cyan-400 ${
                    selectedTool?.name === tool.name
                      ? "border-cyan-500/60 bg-gradient-to-br from-slate-900 to-cyan-900/30"
                      : "border-slate-800 bg-slate-950/80"
                  }`}
                  onClick={() => setSelectedTool(tool)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{tool.name}</p>
                      <h5 className="text-base font-semibold text-white">{tool.label}</h5>
                    </div>
                    <span className="text-xs text-slate-400 transition group-hover:text-white">view</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300 line-clamp-2">{tool.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300">
              <p className="text-[11px] font-semibold text-white">Tool code</p>
              <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                {toolLoading ? "Loading tool details..." : toolCode || "Select a tool to inspect its source."}
              </pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
