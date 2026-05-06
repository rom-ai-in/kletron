"use client";

import React from "react";
import { ExecutionModeSegmented, type ExecutionBackendId } from "./ExecutionModeSegmented";
import { cn } from "../../lib/utils";

export type AgentSessionEngineStripProps = {
  /** User preference when no thread is open */
  preferenceBackend: ExecutionBackendId;
  /** Stored on the run when a thread is open */
  sessionBackend?: ExecutionBackendId | null;
  hasActiveSession: boolean;
  onPreferenceBackendChange?: (next: ExecutionBackendId) => void;
  /** LangGraph-only controls (graph + LLM selectors) */
  langGraphControls: React.ReactNode;
  /** Optional Codex row (model shortcut, etc.) */
  codexControls?: React.ReactNode;
  /** Shared trailing controls (approval mode, depth, …) */
  trailingControls: React.ReactNode;
  className?: string;
};

function resolveDisplayedBackend(
  hasActiveSession: boolean,
  sessionBackend: ExecutionBackendId | null | undefined,
  preference: ExecutionBackendId,
): ExecutionBackendId {
  if (!hasActiveSession) return preference;
  return sessionBackend ?? "langgraph";
}

/**
 * Single-line agent footer: engine toggle + thread hint + graph/LLM + policy + depth.
 * Narrow viewports scroll horizontally instead of wrapping (avoids a second “config row”).
 */
export function AgentSessionEngineStrip({
  preferenceBackend,
  sessionBackend,
  hasActiveSession,
  onPreferenceBackendChange,
  langGraphControls,
  codexControls,
  trailingControls,
  className,
}: AgentSessionEngineStripProps) {
  const displayed = resolveDisplayedBackend(hasActiveSession, sessionBackend, preferenceBackend);
  const switchLocked = hasActiveSession;
  const showLangGraphChrome = displayed === "langgraph";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-nowrap items-center gap-x-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-elegant sm:gap-x-2",
        className,
      )}
    >
      <div className="shrink-0">
        <ExecutionModeSegmented
          value={switchLocked ? displayed : preferenceBackend}
          onChange={switchLocked ? undefined : onPreferenceBackendChange}
          disabled={switchLocked}
          disabledReason="Execution mode is fixed for this conversation."
        />
      </div>
      {!switchLocked ? (
        <span className="hidden shrink-0 text-[10px] text-text-muted md:inline">
          New chats only — set before first send.
        </span>
      ) : (
        <span className="shrink-0 text-[10px] text-text-muted">
          This thread:{" "}
          <span className="font-medium text-text-secondary">
            {displayed === "codex" ? "Codex (ChatGPT)" : "LangGraph"}
          </span>
        </span>
      )}
      {showLangGraphChrome ? langGraphControls : codexControls}
      {trailingControls}
    </div>
  );
}
