"use client";

import React from "react";
import { resolveAgentExecutionBackend } from "../../hooks/agentExecutionSurface";
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

/**
 * Single-line agent footer: engine toggle + graph/LLM or Codex + policy + depth.
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
  const displayed = resolveAgentExecutionBackend({
    preferenceBackend,
    sessionBackend: sessionBackend ?? null,
    hasActiveSession,
  });
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
          disabledReason={`This conversation uses ${displayed === "codex" ? "Codex (CLI)" : "LangGraph"}. Execution engine cannot be changed mid-thread.`}
        />
      </div>
      {showLangGraphChrome ? langGraphControls : codexControls}
      {trailingControls}
    </div>
  );
}
