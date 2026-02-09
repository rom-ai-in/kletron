'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Brain,
  User,
  Zap,
  GitBranch,
  Wrench,
  Eye,
} from 'lucide-react';

export interface SlashCommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  category?: string;
  action: () => void;
}

export interface SlashCommandMenuProps {
  open: boolean;
  onClose: () => void;
  commands: SlashCommandItem[];
  filter?: string;
  className?: string;
}

const defaultIcons: Record<string, React.ReactNode> = {
  plan: <Eye className="h-3.5 w-3.5" />,
  personality: <User className="h-3.5 w-3.5" />,
  model: <Brain className="h-3.5 w-3.5" />,
  skills: <Wrench className="h-3.5 w-3.5" />,
  worktree: <GitBranch className="h-3.5 w-3.5" />,
};

export function SlashCommandMenu({
  open,
  onClose,
  commands,
  filter = '',
  className = '',
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter((cmd) => {
    const query = filter.toLowerCase().replace(/^\//, '');
    if (!query) return true;
    return (
      cmd.label.toLowerCase().includes(query) ||
      cmd.id.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter, open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filtered, selectedIndex, onClose]);

  if (!open || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className={`absolute bottom-full left-0 mb-1 w-72 rounded-lg glass-elevated z-50 overflow-hidden ${className}`}
    >
      <div className="px-3 py-1.5 border-b border-border-subtle">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Commands</span>
      </div>
      <div className="max-h-64 overflow-y-auto scrollbar-elegant py-1">
        {filtered.map((cmd, index) => (
          <button
            key={cmd.id}
            type="button"
            onClick={() => {
              cmd.action();
              onClose();
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
              index === selectedIndex
                ? 'bg-state-selected text-text-primary'
                : 'text-text-secondary hover:bg-state-hover'
            }`}
          >
            <span className="flex-shrink-0 text-text-muted">
              {cmd.icon ?? defaultIcons[cmd.id] ?? <Zap className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">/{cmd.label}</div>
              {cmd.description && (
                <div className="text-[10px] text-text-muted truncate">{cmd.description}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
