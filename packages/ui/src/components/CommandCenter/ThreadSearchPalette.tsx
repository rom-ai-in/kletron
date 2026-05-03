'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Command } from 'lucide-react';
import { parseThreadRecencyMs } from '@kletron/shared/threadRecency';

export interface ThreadSearchPaletteItem {
  id: string;
  title: string;
  updatedAt?: string | null;
  archived?: boolean;
  category?: 'chat' | 'automation';
}

export interface ThreadSearchPaletteProps {
  open: boolean;
  onClose: () => void;
  threads: ThreadSearchPaletteItem[];
  activeThreadId?: string | null;
  onSelect: (threadId: string) => void;
  /** Input placeholder inside the palette (e.g. "Search threads…"). */
  placeholder?: string;
}

function formatRelativeHint(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  if (diffHours < 48) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ThreadSearchPalette({
  open,
  onClose,
  threads,
  activeThreadId,
  onSelect,
  placeholder = 'Search threads…',
}: ThreadSearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? [...threads]
      : threads.filter((t) => t.title.toLowerCase().includes(q));
    base.sort((a, b) => {
      const ma = parseThreadRecencyMs(a.updatedAt);
      const mb = parseThreadRecencyMs(b.updatedAt);
      if (ma == null && mb == null) return 0;
      if (ma == null) return 1;
      if (mb == null) return -1;
      return mb - ma;
    });
    return base;
  }, [threads, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[selectedIndex]) {
            onSelect(filtered[selectedIndex].id);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filtered, selectedIndex, onClose, onSelect]);

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl rounded-xl border border-border-subtle bg-bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search threads"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          <Search className="w-5 h-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none min-w-0"
          />
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-bg-elevated border border-border-subtle shrink-0">
            <Command className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted">K</span>
          </div>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-2 scrollbar-elegant">
          {filtered.map((thread, currentIndex) => {
            const active = thread.id === activeThreadId;
            const hint = formatRelativeHint(thread.updatedAt);
            const badges = [
              thread.archived ? 'Archived' : null,
              thread.category === 'automation' ? 'Auto' : null,
            ].filter(Boolean);
            return (
              <div
                key={thread.id}
                data-index={currentIndex}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                  currentIndex === selectedIndex
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-primary hover:bg-state-hover'
                }`}
                onClick={() => {
                  onSelect(thread.id);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(currentIndex)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{thread.title}</div>
                  {badges.length > 0 ? (
                    <div className="text-[10px] text-text-muted mt-0.5">{badges.join(' · ')}</div>
                  ) : null}
                </div>
                {active ? (
                  <span className="text-[10px] text-text-muted shrink-0">Current</span>
                ) : null}
                {hint ? <span className="text-[10px] text-text-muted shrink-0 tabular-nums">{hint}</span> : null}
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">No threads match</div>
          ) : null}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle text-[10px] text-text-muted">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>Esc Close</span>
          </div>
          <span>
            {filtered.length} thread{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
}
