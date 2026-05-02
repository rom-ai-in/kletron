"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { ChevronDown, Check, Settings2, Shield, Zap } from "lucide-react";
import { cn } from "../../lib/utils";

const OPTIONS: { id: ThreadApprovalMode; label: string; sub?: string }[] = [
  { id: "inherit", label: "Workspace defaults", sub: "Use org tool policy" },
  { id: "confirm_everything", label: "Confirm each tool", sub: "Ask before running tools" },
  { id: "full_auto_thread", label: "Full auto (this chat)", sub: "Runs tools without prompts" },
];

const MODE_ICON: Record<ThreadApprovalMode, typeof Settings2> = {
  inherit: Settings2,
  confirm_everything: Shield,
  full_auto_thread: Zap,
};

const MODE_SHORT: Record<ThreadApprovalMode, string> = {
  inherit: "Default",
  confirm_everything: "Confirm",
  full_auto_thread: "Auto",
};

export type ThreadApprovalModeSelectorProps = {
  value: ThreadApprovalMode;
  onSelect: (mode: ThreadApprovalMode) => void;
  disabled?: boolean;
  disabledReason?: string;
  /** Align the menu to the trigger end so it opens inward when the control sits on the right edge of the window. */
  menuAlign?: "start" | "end";
};

export function ThreadApprovalModeSelector({
  value,
  onSelect,
  disabled,
  disabledReason,
  menuAlign = "end",
}: ThreadApprovalModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [close]);

  const selected = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];
  const displayMode = selected.id;
  const Icon = MODE_ICON[displayMode] ?? Settings2;
  const shortLabel = MODE_SHORT[displayMode] ?? MODE_SHORT.inherit;
  const ariaLabel = `${selected.label}${selected.sub ? `. ${selected.sub}` : ""}`;

  return (
    <div
      ref={containerRef}
      className={cn("relative min-w-0", disabled && "pointer-events-none opacity-60")}
      title={disabled ? disabledReason : undefined}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          "flex h-7 max-w-full shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-bg-surface/80 px-1.5 py-0 text-text-secondary transition-colors",
          "hover:border-border-strong hover:bg-state-hover hover:text-text-primary",
          isOpen && "border-border-strong bg-state-hover text-text-primary"
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
      >
        <Icon className="h-3 w-3 shrink-0 text-text-muted" aria-hidden />
        <span className="max-w-[5.5rem] truncate text-[10px] font-medium">{shortLabel}</span>
        <ChevronDown
          className={cn("h-2.5 w-2.5 shrink-0 text-text-muted transition-transform", isOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      {isOpen && !disabled && (
        <div
          role="listbox"
          aria-label="Approval mode"
          className={cn(
            "absolute bottom-full z-[120] mb-1 flex max-h-60 min-w-[240px] max-w-[min(100vw-1.5rem,22rem)] flex-col overflow-y-auto rounded-lg border border-border-strong bg-bg-surface p-1 shadow-2xl",
            menuAlign === "end" ? "right-0 left-auto" : "left-0"
          )}
        >
          {OPTIONS.map((opt) => {
            const OIcon = MODE_ICON[opt.id];
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(opt.id);
                  close();
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                  active ? "bg-state-active text-text-primary" : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                )}
              >
                <OIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium leading-tight break-words">{opt.label}</span>
                  {opt.sub && (
                    <span className="mt-0.5 block text-[9px] leading-snug text-text-muted break-words">{opt.sub}</span>
                  )}
                </span>
                {active && <Check className="h-3 w-3 shrink-0 text-status-success-text" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
