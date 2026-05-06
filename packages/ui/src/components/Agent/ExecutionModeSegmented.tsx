"use client";

import React from "react";
import { GitBranch, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";

export type ExecutionBackendId = "langgraph" | "codex";

export type ExecutionModeSegmentedProps = {
  value: ExecutionBackendId;
  onChange?: (next: ExecutionBackendId) => void;
  disabled?: boolean;
  /** Explains why switching is disabled (e.g. active thread). */
  disabledReason?: string;
  className?: string;
};

/**
 * Chooses between Kletron’s LangGraph pipeline (provider + graph) and OpenAI Codex (ChatGPT CLI).
 */
export function ExecutionModeSegmented({
  value,
  onChange,
  disabled = false,
  disabledReason,
  className = "",
}: ExecutionModeSegmentedProps) {
  const modes: { id: ExecutionBackendId; label: string; hint: string; icon: React.ReactNode }[] = [
    {
      id: "langgraph",
      label: "LangGraph",
      hint: "Kletron LLM provider + agent graph (automations use this path)",
      icon: <GitBranch className="h-3 w-3 shrink-0 opacity-70" aria-hidden />,
    },
    {
      id: "codex",
      label: "Codex",
      hint: "ChatGPT via local Codex CLI — no Kletron graph or LLM provider row",
      icon: <Sparkles className="h-3 w-3 shrink-0 opacity-70" aria-hidden />,
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Execution engine"
      className={cn(
        "inline-flex rounded-md border border-border-subtle bg-bg-elevated p-0.5",
        className,
      )}
    >
      {modes.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || !onChange}
            title={disabled ? disabledReason ?? m.hint : m.hint}
            onClick={() => onChange?.(m.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors",
              active
                ? "bg-bg-surface text-text-primary [&_svg]:opacity-90"
                : "text-text-muted hover:bg-state-hover hover:text-text-secondary [&_svg]:opacity-50",
              (disabled || !onChange) && "cursor-default opacity-90",
            )}
          >
            {m.icon}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
