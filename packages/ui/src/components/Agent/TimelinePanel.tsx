"use client";

import { useEffect, useMemo, useState } from "react";
import type { TimelineEvent } from "@numezis/shared/types";
import { DurationDisplay, TokenUsageDisplay, formatDuration, formatTokenCount } from "./metrics";
import type { TokenUsageSummary } from "./metrics";

// ─── PhaseItem ──────────────────────────────────────────────────────────────

export function PhaseItem({
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
      className={`w-full px-3 py-2.5 text-left transition-colors border-b border-border-subtle last:border-0 group ${
        isSelected ? "bg-state-selected" : "bg-transparent hover:bg-state-hover"
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span
          className={`text-[12px] font-medium leading-tight ${
            isSelected
              ? "text-text-primary"
              : "text-text-secondary group-hover:text-text-primary"
          }`}
        >
          {event.label}
        </span>
        <div className="flex items-center gap-1.5">
          {event.tokenUsage && event.tokenUsage.totalTokens > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[9px] font-mono text-status-success-text"
              title={`${event.tokenUsage.inputTokens} in + ${event.tokenUsage.outputTokens} out`}
            >
              <svg
                className="h-2.5 w-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatTokenCount(event.tokenUsage.totalTokens)}
            </span>
          )}
          {elapsed && (
            <span
              className={`text-[10px] font-mono ${
                event.status === "running"
                  ? "text-status-warning-text"
                  : event.status === "success"
                  ? "text-status-success-text"
                  : event.status === "error"
                  ? "text-status-error-text"
                  : "text-text-muted"
              }`}
            >
              {elapsed}
            </span>
          )}
          {event.status !== "pending" && (
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                event.status === "success"
                  ? "bg-status-success shadow-[0_0_4px_var(--status-success-border)]"
                  : event.status === "error"
                  ? "bg-status-error"
                  : "bg-status-warning animate-pulse"
              }`}
            />
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
          <div className="h-full w-full bg-status-success animate-progress-loader origin-left" />
        </div>
      )}
    </button>
  );
}

// ─── TimelinePanel ──────────────────────────────────────────────────────────

export type TimelinePanelProps = {
  timeline: TimelineEvent[];
  selectedEventId: string | null;
  onPhaseSelect: (eventId: string) => void;
  className?: string;
  tokenUsage?: TokenUsageSummary;
};

export function TimelinePanel({
  timeline,
  selectedEventId,
  onPhaseSelect,
  className,
  tokenUsage,
}: TimelinePanelProps) {
  const graphDuration = useMemo(() => {
    const startedEvents = timeline.filter((e) => e.startedAt);
    if (!startedEvents.length) return null;
    const firstStart = startedEvents.reduce((min, e) => {
      const t = new Date(e.startedAt!).getTime();
      return t < min ? t : min;
    }, Infinity);
    const anyRunning = timeline.some((e) => e.status === "running");
    if (anyRunning)
      return {
        startedAt: new Date(firstStart).toISOString(),
        endedAt: undefined,
      };
    const endedEvents = timeline.filter((e) => e.endedAt);
    if (!endedEvents.length)
      return {
        startedAt: new Date(firstStart).toISOString(),
        endedAt: undefined,
      };
    const lastEnd = endedEvents.reduce((max, e) => {
      const t = new Date(e.endedAt!).getTime();
      return t > max ? t : max;
    }, 0);
    return {
      startedAt: new Date(firstStart).toISOString(),
      endedAt: new Date(lastEnd).toISOString(),
    };
  }, [timeline]);

  return (
    <section
      className={`flex flex-col h-full bg-bg-surface border-b border-border-subtle overflow-hidden ${className}`}
    >
      <div className="flex-none border-b border-border-subtle px-3 py-2 bg-bg-surface">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Phases
          </h2>
          {graphDuration?.startedAt && (
            <div className="flex items-center gap-3">
              <TokenUsageDisplay tokenUsage={tokenUsage} />
              <DurationDisplay
                startedAt={graphDuration.startedAt}
                endedAt={graphDuration.endedAt}
              />
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
