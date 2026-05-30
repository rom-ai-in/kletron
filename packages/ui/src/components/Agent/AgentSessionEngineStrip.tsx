"use client";

import React from "react";
import { cn } from "../../lib/utils";

export type AgentSessionEngineStripProps = {
  /** Primary controls row (graph + LLM selectors, optional model selector) */
  primaryControls: React.ReactNode;
  /** Shared trailing controls (approval mode, depth, …) */
  trailingControls: React.ReactNode;
  className?: string;
};

/**
 * Single-line agent footer: engine toggle + graph/LLM or Codex + policy + depth.
 * Narrow viewports scroll horizontally instead of wrapping (avoids a second “config row”).
 */
export function AgentSessionEngineStrip({
  primaryControls,
  trailingControls,
  className,
}: AgentSessionEngineStripProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-nowrap items-center gap-x-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-elegant sm:gap-x-2",
        className,
      )}
    >
      {primaryControls}
      {trailingControls}
    </div>
  );
}
