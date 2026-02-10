'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  FolderOpen,
  GitCommitHorizontal,
  TerminalSquare,
  Share2,
  ChevronDown,
  GitCompareArrows,
  Upload,
  GitPullRequest,
  Loader2,
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
  onPush?: () => void;
  onCreatePR?: () => void;
  /** Loading states for git actions */
  committing?: boolean;
  pushing?: boolean;
  creatingPR?: boolean;
  onToggleTerminal?: () => void;
  onToggleChanges?: () => void;
  changesVisible?: boolean;
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
  onPush,
  onCreatePR,
  committing,
  pushing,
  creatingPR,
  onToggleTerminal,
  onToggleChanges,
  changesVisible,
  onShare,
  onRun,
}: TitleBarProps) {
  const [gitMenuOpen, setGitMenuOpen] = useState(false);
  const gitMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!gitMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (gitMenuRef.current && !gitMenuRef.current.contains(e.target as Node)) {
        setGitMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [gitMenuOpen]);

  const hasGitActions = onCommit || onPush || onCreatePR;

  return (
    <header className={`relative z-50 flex h-10 items-center justify-between glass-titlebar px-4 app-region-drag ${!showTrafficLights ? 'pl-[76px]' : ''}`}>
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

        {/* Commit button with dropdown menu */}
        {hasGitActions && (
          <div className="relative" ref={gitMenuRef}>
            <button
              type="button"
              onClick={() => setGitMenuOpen((p) => !p)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                gitMenuOpen
                  ? 'border-border-strong bg-state-hover text-text-primary'
                  : 'border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary hover:border-border-strong'
              }`}
              title="Git actions"
            >
              <GitCommitHorizontal className="h-3 w-3" />
              Commit
              <ChevronDown className={`h-2.5 w-2.5 text-text-muted transition-transform ${gitMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {gitMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-border-subtle py-1 animate-in fade-in slide-in-from-top-1 duration-150" style={{ backgroundColor: '#1e1e22', boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)' }}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Git actions
                </div>

                {/* Commit */}
                {onCommit && (
                  <button
                    type="button"
                    onClick={() => {
                      setGitMenuOpen(false);
                      onCommit();
                    }}
                    disabled={committing}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-text-secondary hover:text-text-primary hover:bg-state-hover transition-colors disabled:opacity-50"
                  >
                    {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCommitHorizontal className="h-3.5 w-3.5" />}
                    <span>Commit</span>
                  </button>
                )}

                {/* Push */}
                {onPush && (
                  <button
                    type="button"
                    onClick={() => {
                      setGitMenuOpen(false);
                      onPush();
                    }}
                    disabled={pushing}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-text-secondary hover:text-text-primary hover:bg-state-hover transition-colors disabled:opacity-50"
                  >
                    {pushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    <span>Push</span>
                  </button>
                )}

                {/* Create PR */}
                {onCreatePR && (
                  <>
                    <div className="my-1 border-t border-border-subtle" />
                    <button
                      type="button"
                      onClick={() => {
                        setGitMenuOpen(false);
                        onCreatePR();
                      }}
                      disabled={creatingPR}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-text-secondary hover:text-text-primary hover:bg-state-hover transition-colors disabled:opacity-50"
                    >
                      {creatingPR ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitPullRequest className="h-3.5 w-3.5" />}
                      <span>Create PR</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Separator */}
        {(onOpen || hasGitActions) && (onToggleTerminal || onToggleChanges || onShare || gitDiffStats) && (
          <div className="w-px h-4 bg-border-subtle mx-0.5" />
        )}

        {/* Uncommitted Changes */}
        {onToggleChanges && (
          <button
            type="button"
            onClick={onToggleChanges}
            className={`rounded-md p-1.5 transition-colors ${changesVisible ? 'text-accent-cyan bg-accent-cyan/10' : 'text-text-muted hover:text-text-primary hover:bg-state-hover'}`}
            title="Toggle uncommitted changes (⌘⇧G)"
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
          </button>
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
