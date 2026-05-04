"use client";

import React from "react";
import { Briefcase, Code2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { WORK_MODES, type WorkModeId } from "@kletron/shared/workMode";

const MODE_ICONS: Record<WorkModeId, React.ReactNode> = {
  code: <Code2 className="h-3 w-3 shrink-0 opacity-55" aria-hidden />,
  work: <Briefcase className="h-3 w-3 shrink-0 opacity-55" aria-hidden />,
};

export type WorkModeSegmentedProps = {
  value: WorkModeId;
  onChange: (mode: WorkModeId) => void;
  className?: string;
  disabled?: boolean;
  /** Stretch to container width (e.g. narrow thread sidebar). */
  fullWidth?: boolean;
  /** Muted icons per segment (sidebar-friendly). */
  showIcons?: boolean;
};

/**
 * Segmented Code | Work control — use when only the two built-in modes exist.
 */
export function WorkModeSegmented({
  value,
  onChange,
  className = "",
  disabled = false,
  fullWidth = false,
  showIcons = false,
}: WorkModeSegmentedProps) {
  const modes: WorkModeId[] = ["code", "work"];

  return (
    <div
      role="group"
      aria-label="Work mode"
      className={cn(
        "rounded-md border border-white/[0.08] bg-bg-elevated/80 p-0.5",
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
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
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              showIcons && "inline-flex items-center justify-center gap-1.5",
              fullWidth && "min-w-0 flex-1",
              active
                ? "bg-white/[0.12] text-text-primary shadow-sm [&_svg]:opacity-80 [&_svg]:text-text-secondary"
                : "text-text-muted hover:text-text-secondary [&_svg]:opacity-45",
              disabled && "opacity-50",
            )}
          >
            {showIcons ? MODE_ICONS[id] : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
