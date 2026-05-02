'use client';

import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { CornerDownLeft, Zap, GitBranch, Wrench, Eye } from 'lucide-react';
import {
  filterSlashCommandItems,
  SLASH_SECTION_LABEL,
  SLASH_SECTION_ORDER,
  resolveSlashSectionId,
  type SlashCommandSectionId,
} from './slashCommandMenuUtils';

export type { SlashCommandSectionId };

export interface SlashCommandItem {
  id: string;
  /** Palette section; defaults to `commands` when omitted. */
  sectionId?: SlashCommandSectionId;
  /** Shown as `/label` in the primary line. */
  label: string;
  description?: string;
  icon?: React.ReactNode;
  /** @deprecated use sectionId */
  category?: string;
  action: () => void;
}

export interface SlashCommandMenuProps {
  open: boolean;
  onClose: () => void;
  commands: SlashCommandItem[];
  filter?: string;
  className?: string;
  /** Max items per section before "Show more" (default 5). */
  initialPerSection?: number;
}

const defaultIcons: Record<string, React.ReactNode> = {
  plan: <Eye className="h-3.5 w-3.5" />,
  skills: <Wrench className="h-3.5 w-3.5" />,
  worktree: <GitBranch className="h-3.5 w-3.5" />,
};

export function SlashCommandMenu({
  open,
  onClose,
  commands,
  filter = '',
  className = '',
  initialPerSection = 5,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Partial<Record<SlashCommandSectionId, boolean>>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const flatRef = useRef<SlashCommandItem[]>([]);
  const selectedRef = useRef(0);

  const filtered = useMemo(() => filterSlashCommandItems(commands, filter), [commands, filter]);

  const { sections, flatItems } = useMemo(() => {
    const bySection = new Map<SlashCommandSectionId, SlashCommandItem[]>();
    for (const id of SLASH_SECTION_ORDER) {
      bySection.set(id, []);
    }
    for (const cmd of filtered) {
      const sid = resolveSlashSectionId(cmd.sectionId);
      if (!bySection.has(sid)) {
        bySection.set(sid, []);
      }
      bySection.get(sid)!.push(cmd);
    }

    const sectionsOut: Array<{
      sectionId: SlashCommandSectionId;
      label: string;
      all: SlashCommandItem[];
      visible: SlashCommandItem[];
      hasMore: boolean;
      moreCount: number;
    }> = [];

    const flat: SlashCommandItem[] = [];

    for (const sectionId of SLASH_SECTION_ORDER) {
      const all = bySection.get(sectionId) ?? [];
      if (all.length === 0) continue;

      const expanded = expandedSections[sectionId] === true;
      const cap = expanded ? all.length : Math.min(initialPerSection, all.length);
      const visible = all.slice(0, cap);
      const hasMore = !expanded && all.length > cap;
      const moreCount = all.length - cap;

      sectionsOut.push({
        sectionId,
        label: SLASH_SECTION_LABEL[sectionId],
        all,
        visible,
        hasMore,
        moreCount,
      });
      for (const item of visible) {
        flat.push(item);
      }
    }

    return { sections: sectionsOut, flatItems: flat };
  }, [filtered, expandedSections, initialPerSection]);

  useLayoutEffect(() => {
    flatRef.current = flatItems;
  }, [flatItems]);

  useLayoutEffect(() => {
    selectedRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter, open]);

  useEffect(() => {
    if (!open) {
      setExpandedSections({});
    }
  }, [open]);

  useEffect(() => {
    setExpandedSections({});
  }, [filter]);

  useEffect(() => {
    if (flatItems.length > 0 && selectedIndex >= flatItems.length) {
      setSelectedIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, selectedIndex]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      const flat = flatRef.current;
      if (flat.length === 0) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % flat.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + flat.length) % flat.length);
        return;
      }
      if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        const idx = selectedRef.current;
        const cmd = flat[idx];
        if (cmd) {
          cmd.action();
          onClose();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  if (!open || flatItems.length === 0) return null;

  return (
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Slash commands"
      className={`absolute bottom-full left-0 z-50 mb-1 max-h-[min(24rem,50vh)] min-w-[22rem] max-w-lg overflow-hidden rounded-lg glass-elevated ${className}`}
    >
      <div className="max-h-[inherit] overflow-y-auto scrollbar-elegant py-1">
        {sections.map((sec) => (
          <div key={sec.sectionId} className="border-b border-border-subtle last:border-b-0">
            <div className="px-3 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {sec.label}
              </span>
            </div>
            {sec.visible.map((cmd) => {
              const index = flatItems.indexOf(cmd);
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={`${sec.sectionId}-${cmd.id}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-state-selected text-text-primary'
                      : 'text-text-secondary hover:bg-state-hover'
                  }`}
                >
                  <span className="flex-shrink-0 text-text-muted">
                    {cmd.icon ?? defaultIcons[cmd.id] ?? <Zap className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">/{cmd.label}</div>
                    {cmd.description ? (
                      <div className="line-clamp-2 text-[10px] text-text-muted">{cmd.description}</div>
                    ) : null}
                  </div>
                  {isSelected ? (
                    <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-text-muted" aria-hidden />
                  ) : (
                    <span className="w-3.5 flex-shrink-0" aria-hidden />
                  )}
                </button>
              );
            })}
            {sec.hasMore ? (
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-[11px] text-text-muted transition-colors hover:bg-state-hover hover:text-text-secondary"
                onClick={() =>
                  setExpandedSections((prev) => ({ ...prev, [sec.sectionId]: true }))
                }
              >
                Show {sec.moreCount} more
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
