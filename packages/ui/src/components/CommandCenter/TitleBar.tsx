'use client';

import React from 'react';
import {
  Play,
  FolderOpen,
  GitCommitHorizontal,
  TerminalSquare,
  Share2,
  ChevronDown,
} from 'lucide-react';
import { TrafficLights } from '../ui/TrafficLights';

export interface GitDiffStats {
  additions: number;
  deletions: number;
}

export interface TitleBarProps {
  workspaceName?: string;
  /** Optional extra content rendered in the center */
  center?: React.ReactNode;
  /** Git diff stats to show on the right */
  gitDiffStats?: GitDiffStats | null;
  /** Show custom traffic light dots (set false in Electron where native ones exist) */
  showTrafficLights?: boolean;
  /** Callbacks for top-bar actions */
  onOpen?: () => void;
  onCommit?: () => void;
  onToggleTerminal?: () => void;
  onShare?: () => void;
  onRun?: () => void;
}

export function TitleBar({
  workspaceName = 'Numezis Desktop',
  center,
  gitDiffStats,
  showTrafficLights = true,
  onOpen,
  onCommit,
  onToggleTerminal,
  onShare,
  onRun,
}: TitleBarProps) {
  return (
    <header className={`flex h-10 items-center justify-between glass-titlebar px-4 app-region-drag ${!showTrafficLights ? 'pl-[76px]' : ''}`}>
      {/* Left: traffic lights (hidden in Electron where native ones exist) + workspace name */}
      <div className="flex items-center gap-3">
        {showTrafficLights && <TrafficLights className="app-region-no-drag" />}
        <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          {workspaceName}
        </div>
      </div>

      {/* Center: optional content */}
      {center && <div className="flex-1 flex items-center justify-center app-region-no-drag">{center}</div>}

      {/* Right: action buttons (Codex-style) */}
      <div className="flex items-center gap-1.5 app-region-no-drag">
        {/* Run */}
        {onRun && (
          <button
            type="button"
            onClick={onRun}
            className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
            title="Run"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Open button with dropdown style */}
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="flex items-center gap-1 rounded-full border border-border-subtle bg-bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
            title="Open in editor"
          >
            <FolderOpen className="h-3 w-3" />
            Open
            <ChevronDown className="h-2.5 w-2.5 text-text-muted" />
          </button>
        )}

        {/* Commit button with dropdown style */}
        {onCommit && (
          <button
            type="button"
            onClick={onCommit}
            className="flex items-center gap-1 rounded-full border border-border-subtle bg-bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
            title="Commit changes"
          >
            <GitCommitHorizontal className="h-3 w-3" />
            Commit
            <ChevronDown className="h-2.5 w-2.5 text-text-muted" />
          </button>
        )}

        {/* Separator */}
        {(onOpen || onCommit) && (onToggleTerminal || onShare || gitDiffStats) && (
          <div className="w-px h-4 bg-border-subtle mx-0.5" />
        )}

        {/* Terminal */}
        {onToggleTerminal && (
          <button
            type="button"
            onClick={onToggleTerminal}
            className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
            title="Toggle terminal (⌘J)"
          >
            <TerminalSquare className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Share */}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
            title="Share"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Git diff stats */}
        {gitDiffStats && (gitDiffStats.additions > 0 || gitDiffStats.deletions > 0) && (
          <div className="flex items-center gap-1 ml-1 text-[11px] font-mono">
            {gitDiffStats.additions > 0 && (
              <span className="text-green-400">+{gitDiffStats.additions}</span>
            )}
            {gitDiffStats.deletions > 0 && (
              <span className="text-red-400">-{gitDiffStats.deletions}</span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
