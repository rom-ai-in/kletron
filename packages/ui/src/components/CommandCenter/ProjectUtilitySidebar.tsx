'use client';

import React, { useMemo, useState } from 'react';
import {
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Search,
  GitBranch,
  GitCommit,
  Plus,
  Minus,
  RefreshCw,
  Sparkles,
  Loader2,
  Undo2,
  MoreHorizontal,
  Copy,
} from 'lucide-react';
import { Button } from '../design-system';
import { GitChangeTree } from './GitChangeTree';
import type { GitFileChangeItem } from './GitChangeTree';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingDiffItem {
  editId: string;
  filePath: string;
  additions?: number;
  deletions?: number;
}

export interface FileLink {
  path: string;
  label: string;
  type?: 'read' | 'write' | 'search';
}

export interface GitSidebarData {
  branch?: string;
  ahead?: number;
  behind?: number;
  totalChanges: number;
  modified?: string[];
  created?: string[];
  deleted?: string[];
  /** Staged files (in the index) */
  staged?: GitFileChangeItem[];
  /** Unstaged files (working tree changes) */
  unstaged?: GitFileChangeItem[];
  commitMessage?: string;
  committing?: boolean;
  generatingMessage?: boolean;
  loading?: boolean;
  error?: string | null;
}

export type SourceControlTab = 'unstaged' | 'staged';

export interface ProjectUtilitySidebarProps {
  /** Files touched by the agent in this conversation */
  fileLinks?: FileLink[];
  /** Pending diffs awaiting review */
  pendingDiffs?: PendingDiffItem[];
  onOpenDiff?: (editId: string) => void;
  onAcceptDiff?: (editId: string) => void;
  onRejectDiff?: (editId: string) => void;
  onOpenInIDE?: (filePath: string) => void;
  /** Git integration */
  gitData?: GitSidebarData | null;
  onGitCommit?: (message: string) => void;
  onGitCommitStaged?: (message: string) => void;
  onGitRefresh?: () => void;
  onGitGenerateMessage?: () => void;
  onCommitMessageChange?: (message: string) => void;
  /** Per-file git actions */
  onGitStageFile?: (path: string) => void;
  onGitStageAll?: () => void;
  onGitUnstageFile?: (path: string) => void;
  onGitUnstageAll?: () => void;
  onGitRevertFile?: (path: string) => void;
  onGitRevertAll?: () => void;
  /** Diff viewer */
  onViewFileDiff?: (file: GitFileChangeItem, staged: boolean) => void;
  selectedDiffPath?: string | null;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectUtilitySidebar({
  fileLinks = [],
  pendingDiffs = [],
  onOpenDiff,
  onAcceptDiff,
  onRejectDiff,
  onOpenInIDE,
  gitData,
  onGitCommit,
  onGitCommitStaged,
  onGitRefresh,
  onGitGenerateMessage,
  onCommitMessageChange,
  onGitStageFile,
  onGitStageAll,
  onGitUnstageFile,
  onGitUnstageAll,
  onGitRevertFile,
  onGitRevertAll,
  onViewFileDiff,
  selectedDiffPath,
  className = '',
}: ProjectUtilitySidebarProps) {
  const [activeTab, setActiveTab] = useState<SourceControlTab>('unstaged');
  const [filter, setFilter] = useState('');
  const [diffsCollapsed, setDiffsCollapsed] = useState(false);
  const [filesCollapsed, setFilesCollapsed] = useState(true);

  const stagedFiles = gitData?.staged ?? [];
  const unstagedFiles = gitData?.unstaged ?? [];
  const totalStaged = stagedFiles.length;
  const totalUnstaged = unstagedFiles.length;

  // Filter files by search term
  const filteredFiles = useMemo(() => {
    const files = activeTab === 'staged' ? stagedFiles : unstagedFiles;
    if (!filter.trim()) return files;
    const term = filter.toLowerCase();
    return files.filter(f => f.path.toLowerCase().includes(term));
  }, [activeTab, stagedFiles, unstagedFiles, filter]);

  const isStaged = activeTab === 'staged';

  return (
    <div className={`flex flex-col h-full w-[300px] flex-shrink-0 glass-sidebar border-l border-glass-border ${className}`}>

      {/* ── Unstaged / Staged Tab Bar (Cursor-style) ── */}
      <div className="flex items-center gap-0 border-b border-border-subtle">
        <button
          type="button"
          onClick={() => setActiveTab('unstaged')}
          className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition-colors ${
            activeTab === 'unstaged'
              ? 'text-text-primary bg-state-active'
              : 'text-text-muted hover:text-text-secondary hover:bg-state-hover'
          }`}
        >
          Unstaged
          {totalUnstaged > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeTab === 'unstaged'
                ? 'bg-text-primary/10 text-text-primary'
                : 'bg-text-muted/10 text-text-muted'
            }`}>
              {totalUnstaged}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('staged')}
          className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition-colors ${
            activeTab === 'staged'
              ? 'text-text-primary bg-state-active'
              : 'text-text-muted hover:text-text-secondary hover:bg-state-hover'
          }`}
        >
          Staged
          {totalStaged > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeTab === 'staged'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-text-muted/10 text-text-muted'
            }`}>
              {totalStaged}
            </span>
          )}
        </button>

        {/* Right-side actions */}
        <div className="ml-auto flex items-center gap-0.5 pr-2">
          {/* Stage/Unstage all */}
          {activeTab === 'unstaged' && onGitStageAll && totalUnstaged > 0 && (
            <button
              type="button"
              onClick={onGitStageAll}
              className="p-1 rounded text-text-muted hover:text-green-400 hover:bg-green-400/10 transition-colors"
              title="Stage all changes"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {activeTab === 'staged' && onGitUnstageAll && totalStaged > 0 && (
            <button
              type="button"
              onClick={onGitUnstageAll}
              className="p-1 rounded text-text-muted hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
              title="Unstage all"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Discard all (unstaged only) */}
          {activeTab === 'unstaged' && onGitRevertAll && totalUnstaged > 0 && (
            <button
              type="button"
              onClick={onGitRevertAll}
              className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Discard all changes"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Refresh */}
          {onGitRefresh && (
            <button
              type="button"
              onClick={onGitRefresh}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${gitData?.loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Input ── */}
      <div className="px-2 py-1.5 border-b border-border-subtle">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter files..."
            className="w-full rounded-md bg-bg-surface border border-border-subtle py-1 pl-7 pr-2 text-[11px] text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
          />
        </div>
      </div>

      {/* ── Changed Files Tree ── */}
      <div className="flex-1 overflow-y-auto scrollbar-elegant">
        {filteredFiles.length > 0 ? (
          <GitChangeTree
            files={filteredFiles}
            section={activeTab}
            selectedPath={selectedDiffPath}
            onFileClick={(f) => onViewFileDiff?.(f, isStaged)}
            onStageFile={!isStaged ? onGitStageFile : undefined}
            onUnstageFile={isStaged ? onGitUnstageFile : undefined}
            onRevertFile={!isStaged ? onGitRevertFile : undefined}
          />
        ) : gitData?.loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
          </div>
        ) : filter ? (
          <div className="px-3 py-6 text-[11px] text-text-muted text-center">
            No files matching "{filter}"
          </div>
        ) : (
          <div className="px-3 py-6 text-[11px] text-text-muted text-center">
            {isStaged ? 'No staged changes' : 'Working tree clean'}
          </div>
        )}
      </div>

      {/* ── Bottom Panel: Commit + extras ── */}
      <div className="border-t border-border-subtle">

        {/* ── Branch row ── */}
        {gitData && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border-subtle">
            <GitBranch className="h-3 w-3 text-text-muted flex-shrink-0" />
            <span className="text-[11px] font-mono text-text-primary truncate">
              {gitData.branch || 'detached'}
            </span>
            {(gitData.ahead ?? 0) > 0 && (
              <span className="text-[10px] text-text-muted">↑{gitData.ahead}</span>
            )}
            {(gitData.behind ?? 0) > 0 && (
              <span className="text-[10px] text-text-muted">↓{gitData.behind}</span>
            )}
          </div>
        )}

        {/* ── Commit Area ── */}
        {gitData && (gitData.totalChanges > 0 || totalStaged > 0) && (onGitCommit || onGitCommitStaged) && (
          <div className="px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={gitData.commitMessage ?? ''}
                onChange={(e) => onCommitMessageChange?.(e.target.value)}
                placeholder="Commit message..."
                className="flex-1 min-w-0 rounded border border-border-subtle bg-bg-app px-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && gitData.commitMessage?.trim()) {
                    e.preventDefault();
                    if (totalStaged > 0 && onGitCommitStaged) {
                      onGitCommitStaged(gitData.commitMessage!.trim());
                    } else if (onGitCommit) {
                      onGitCommit(gitData.commitMessage!.trim());
                    }
                  }
                }}
              />
              {onGitGenerateMessage && (
                <button
                  type="button"
                  onClick={onGitGenerateMessage}
                  disabled={gitData.generatingMessage}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors disabled:opacity-50"
                  title="Generate commit message with AI"
                >
                  {gitData.generatingMessage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                </button>
              )}
            </div>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                if (gitData.commitMessage?.trim()) {
                  if (totalStaged > 0 && onGitCommitStaged) {
                    onGitCommitStaged(gitData.commitMessage.trim());
                  } else if (onGitCommit) {
                    onGitCommit(gitData.commitMessage.trim());
                  }
                }
              }}
              disabled={!gitData.commitMessage?.trim() || gitData.committing}
              className="w-full"
            >
              <GitCommit className="h-3 w-3 mr-1" />
              {gitData.committing
                ? 'Committing...'
                : totalStaged > 0
                  ? `Commit Staged (${totalStaged})`
                  : 'Commit All'
              }
            </Button>
            {gitData.error && (
              <div className="text-[10px] text-status-error-text">{gitData.error}</div>
            )}
          </div>
        )}

        {/* ── Pending Agent Reviews (collapsible) ── */}
        {pendingDiffs.length > 0 && (
          <div className="border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setDiffsCollapsed(!diffsCollapsed)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:bg-state-hover transition-colors"
            >
              {diffsCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>Pending Reviews</span>
              <span className="ml-auto rounded-full bg-status-warning-bg text-status-warning-text px-1.5 py-0.5 text-[9px] font-bold">
                {pendingDiffs.length}
              </span>
            </button>
            {!diffsCollapsed && (
              <div className="px-2 pb-2 space-y-0.5">
                {pendingDiffs.map((diff) => (
                  <div
                    key={diff.editId}
                    className="flex items-center justify-between gap-1 rounded-md px-2 py-1 text-xs hover:bg-state-hover transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenDiff?.(diff.editId)}
                      className="flex-1 text-left truncate text-text-secondary hover:text-text-primary flex items-center gap-1.5"
                    >
                      <FileText className="h-3 w-3 text-text-muted flex-shrink-0" />
                      <span className="truncate font-mono text-[11px]">{diff.filePath.split('/').pop()}</span>
                    </button>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Button size="xs" variant="secondary" onClick={() => onAcceptDiff?.(diff.editId)}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => onRejectDiff?.(diff.editId)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Agent Files (collapsible, at the very bottom) ── */}
        {fileLinks.length > 0 && (
          <div className="border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setFilesCollapsed(!filesCollapsed)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:bg-state-hover transition-colors"
            >
              {filesCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>Agent Files</span>
              <span className="ml-auto text-[10px] text-text-muted">{fileLinks.length}</span>
            </button>
            {!filesCollapsed && (
              <div className="px-2 pb-2 space-y-0.5">
                {fileLinks.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center justify-between gap-1 rounded-md px-2 py-0.5 text-[11px] text-text-secondary hover:bg-state-hover transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <FileText className="h-3 w-3 text-text-muted flex-shrink-0" />
                      <span className="truncate font-mono" title={file.path}>{file.label}</span>
                    </div>
                    {onOpenInIDE && (
                      <button
                        type="button"
                        onClick={() => onOpenInIDE(file.path)}
                        className="p-0.5 text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
                        title="Open in IDE"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
