"use client";

import { useCallback, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import type { AgentEvent, AgentEventKind } from "@kletron/shared/types";
import { MarkdownRenderer } from "./MarkdownRenderer";

// ─── Constants ──────────────────────────────────────────────────────────────

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

// ─── Utilities ──────────────────────────────────────────────────────────────

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

// ─── EventCard ──────────────────────────────────────────────────────────────

export type EventCardProps = {
  event: AgentEvent;
};

export function EventCard({ event }: EventCardProps) {
  const isToolEvent = event.kind === "tool";
  const formattedArgs = formatJsonString(event.toolArgs);
  const resultTextRaw = event.content?.trim() ?? "";
  const resultText = resultTextRaw || (isToolEvent ? "" : "No response yet.");
  const [isExpanded, setIsExpanded] = useState(false);

  const titleText = isToolEvent
    ? event.name ?? "Tool output"
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

  const handleCopyResponse = useCallback(() => {
    if (!resultText) return;
    navigator.clipboard
      ?.writeText(agentMarkdown || resultText)
      .then(() => {
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 1500);
      })
      .catch(() => {
        setCopyStatus("error");
        setTimeout(() => setCopyStatus("idle"), 1500);
      });
  }, [agentMarkdown, resultText]);

  const firstMeaningfulLine = (() => {
    const lines = resultText.split(/\r?\n/);
    const generalSkips = [/^[\{\[\]\}]+$/, /^[\{\[\]\}]+;?$/, /^\/\*/, /^\*+\//, /^\/\/+/, /^#!/];
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
    firstMeaningfulLine.length > 200 ? `${firstMeaningfulLine.slice(0, 200)}...` : firstMeaningfulLine;
  const toggleExpanded = () => setIsExpanded((prev) => !prev);
  const badgeClass = eventBadgeStyles[event.kind];
  const badgeLabel = eventBadgeLabel[event.kind];

  const handleClick = (e: ReactMouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    toggleExpanded();
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <article
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={`group cursor-pointer rounded-lg border border-border-subtle bg-bg-surface text-text-primary transition duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring ${isToolEvent
          ? "hover:border-border-strong border-l-2 border-l-text-muted"
          : "hover:border-border-strong shadow-sm"
        }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-text-muted">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
            {badgeLabel}
          </span>
          <p className={`text-xs font-medium text-text-primary truncate leading-tight ${isToolEvent ? "font-mono" : ""}`}>
            {titleText}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
          <span className="whitespace-nowrap text-[10px] text-text-muted">{formatTimestamp(event.timestamp)}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
            aria-expanded={isExpanded}
            className="flex h-6 w-6 items-center justify-center rounded border border-border-subtle bg-bg-elevated text-text-muted transition duration-150 hover:bg-state-hover hover:text-text-primary"
          >
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

      {/* Collapsed preview */}
      {!isExpanded && (
        <div className="space-y-1 px-3 pb-3 text-[11px] text-text-muted">
          {isToolEvent && argsPreview && (
            <p className="truncate font-mono">
              <span className="text-text-muted/60">Args:</span> {argsPreview}
            </p>
          )}
          <p className={`truncate ${isToolEvent ? "font-mono" : ""}`}>
            {isToolEvent && <span className="text-text-muted/60">Result: </span>}
            {collapsedPreview || "No output yet"}
          </p>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border-subtle px-3 pb-3 pt-2 space-y-2">
          {isToolEvent && formattedArgs && (
            <div>
              <p className="text-[10px] text-text-muted mb-1">Arguments</p>
              <pre className="rounded-lg border border-border-subtle bg-bg-elevated p-2 text-[11px] font-mono text-text-secondary overflow-auto max-h-48 whitespace-pre-wrap">
                {formattedArgs}
              </pre>
            </div>
          )}
          <div>
            {isToolEvent && <p className="text-[10px] text-text-muted mb-1">Result</p>}
            {agentMarkdown ? (
              <MarkdownRenderer content={agentMarkdown} />
            ) : (
              <pre className="rounded-lg border border-border-subtle bg-bg-elevated p-2 text-[11px] font-mono text-text-secondary overflow-auto max-h-96 whitespace-pre-wrap">
                {resultText}
              </pre>
            )}
          </div>
          {event.kind === "assistant" && resultText && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyResponse();
              }}
              className="flex items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-[10px] text-text-secondary transition hover:bg-state-hover"
            >
              {copyStatus === "copied" ? "Copied!" : "Copy response"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
