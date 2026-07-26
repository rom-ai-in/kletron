"use client";

import React from "react";
import { Briefcase, Code2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { WORK_MODES, type WorkModeId } from "@kletron/shared/workMode";
import { SidebarSegmented, type SidebarSegmentedOption } from "../nav/SidebarNav";

const MODE_ICONS = {
  code: Code2,
  work: Briefcase,
} as const;

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
 * Shares its look with the primary sidebar nav (`SidebarSegmented`).
 */
export function WorkModeSegmented({
  value,
  onChange,
  className = "",
  disabled = false,
  fullWidth = false,
  showIcons = false,
}: WorkModeSegmentedProps) {
  /** Work first, Code second — the product's default reading order. */
  const options: SidebarSegmentedOption<WorkModeId>[] = (["work", "code"] as const).map((id) => ({
    id,
    label: WORK_MODES[id].name,
    title: WORK_MODES[id].description,
    ...(showIcons ? { icon: MODE_ICONS[id] } : {}),
  }));

  return (
    <SidebarSegmented
      ariaLabel="Work mode"
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={cn(fullWidth && "flex w-full", className)}
    />
  );
}
