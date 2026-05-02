"use client";

import React from "react";
import { WORK_MODES, type WorkModeId } from "@kletron/shared/workMode";

export type WorkModeSegmentedProps = {
  value: WorkModeId;
  onChange: (mode: WorkModeId) => void;
  className?: string;
  disabled?: boolean;
};

/**
 * Segmented Code | Work control — use when only the two built-in modes exist.
 */
export function WorkModeSegmented({ value, onChange, className = "", disabled = false }: WorkModeSegmentedProps) {
  const modes: WorkModeId[] = ["code", "work"];

  return (
    <div
      role="group"
      aria-label="Work mode"
      className={`inline-flex rounded-md border border-white/[0.08] bg-bg-elevated/80 p-0.5 ${className}`}
    >
      {modes.map((id) => {
        const active = value === id;
        const label = WORK_MODES[id].name;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            title={WORK_MODES[id].description}
            onClick={() => onChange(id)}
            className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "bg-white/[0.12] text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            } disabled:opacity-50`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
