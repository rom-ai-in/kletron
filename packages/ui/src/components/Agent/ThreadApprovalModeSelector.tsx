"use client";

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { ChevronDown, Check, Settings2, Shield, Zap } from "lucide-react";
import { cn } from "../../lib/utils";

/** Match {@link Selector} menus — above modal overlays and typical nested chrome */
const POLICY_MENU_Z = 200;

const OPTIONS: { id: ThreadApprovalMode; label: string; sub?: string }[] = [
  { id: "inherit", label: "Workspace policy", sub: "Rules from Configuration → Workspace" },
  { id: "confirm_everything", label: "Confirm each tool", sub: "Prompt before every tool call" },
  { id: "full_auto_thread", label: "Full auto (this chat)", sub: "Auto-run tools; blocklist still prompts" },
];

const MODE_ICON: Record<ThreadApprovalMode, typeof Settings2> = {
  inherit: Settings2,
  confirm_everything: Shield,
  full_auto_thread: Zap,
};

const MODE_SHORT: Record<ThreadApprovalMode, string> = {
  inherit: "Policy",
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
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  const updateMenuPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setMenuRect(el.getBoundingClientRect());
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || disabled) return;
    updateMenuPosition();
  }, [isOpen, disabled, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen || disabled) return;
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [isOpen, disabled, updateMenuPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (menuPortalRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        onClick={() => {
          if (disabled) return;
          if (!isOpen) {
            setMenuRect(containerRef.current?.getBoundingClientRect() ?? null);
          }
          setIsOpen((open) => !open);
        }}
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

      {isOpen &&
        !disabled &&
        menuRect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuPortalRef}
            role="listbox"
            aria-label="Tool policy mode"
            style={{
              position: "fixed",
              zIndex: POLICY_MENU_Z,
              bottom: window.innerHeight - menuRect.top + 4,
              ...(menuAlign === "end"
                ? { right: window.innerWidth - menuRect.right }
                : { left: menuRect.left }),
              minWidth: 240,
              maxWidth: "min(calc(100vw - 1.5rem), 22rem)",
              maxHeight: Math.max(120, menuRect.top - 12),
            }}
            className="flex flex-col overflow-y-auto rounded-lg border border-border-strong bg-bg-surface p-1 shadow-2xl"
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
          </div>,
          document.body
        )}
    </div>
  );
}
