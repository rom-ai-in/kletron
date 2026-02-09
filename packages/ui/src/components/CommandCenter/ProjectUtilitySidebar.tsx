'use client';

import React, { useState } from 'react';
import {
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Eye,
  GitBranch,
  GitCommit,
  Plus,
  Minus,
  RefreshCw,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '../design-system';

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
  commitMessage?: string;
  committing?: boolean;
  generatingMessage?: boolean;
  loading?: boolean;
  error?: string | null;
}

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
  onGitRefresh?: () => void;
  onGitGenerateMessage?: () => void;
  onCommitMessageChange?: (message: string) => void;
  className?: string;
}

export function ProjectUtilitySidebar({
  fileLinks = [],
  pendingDiffs = [],
  onOpenDiff,
  onAcceptDiff,
  onRejectDiff,
  onOpenInIDE,
  gitData,
  onGitCommit,
  onGitRefresh,
  onGitGenerateMessage,
  onCommitMessageChange,
  className = '',
}: ProjectUtilitySidebarProps) {
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const [diffsCollapsed, setDiffsCollapsed] = useState(false);
  const [gitCollapsed, setGitCollapsed] = useState(false);
  const [gitChangesExpanded, setGitChangesExpanded] = useState(false);

  return (
    <div className={`flex flex-col h-full w-[300px] flex-shrink-0 glass-sidebar border-l border-glass-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Context
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-elegant">
        {/* ── Git Section (Codex-style) ── */}
        {gitData && (
          <div className="border-b border-border-subtle">
            <button
              type="button"
              onClick={() => setGitCollapsed(!gitCollapsed)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary hover:bg-state-hover transition-colors"
            >
              {gitCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <GitBranch className="h-3 w-3" />
              <span>Git</span>
              {gitData.totalChanges > 0 && (
                <span className="ml-auto rounded-full bg-blue-500/10 text-blue-400 px-1.5 py-0.5 text-[10px] font-semibold">
                  {gitData.totalChanges}
                </span>
              )}
            </button>

            {!gitCollapsed && (
              <div className="px-3 pb-3 space-y-2">
                {/* Branch & sync status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GitBranch className="h-3 w-3 text-text-muted flex-shrink-0" />
                    <span className="text-[11px] font-mono text-text-primary truncate">
                      {gitData.branch || 'detached'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(gitData.ahead ?? 0) > 0 && (
                      <span className="text-[10px] text-text-muted" title={`${gitData.ahead} ahead`}>↑{gitData.ahead}</span>
                    )}
                    {(gitData.behind ?? 0) > 0 && (
                      <span className="text-[10px] text-text-muted" title={`${gitData.behind} behind`}>↓{gitData.behind}</span>
                    )}
                    {onGitRefresh && (
                      <button
                        type="button"
                        onClick={onGitRefresh}
                        className="p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
                        title="Refresh git status"
                      >
                        <RefreshCw className={`h-3 w-3 ${gitData.loading ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Change summary */}
                {gitData.totalChanges > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setGitChangesExpanded(!gitChangesExpanded)}
                      className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary transition-colors w-full"
                    >
                      {gitChangesExpanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                      <span className="flex items-center gap-2">
                        {(gitData.modified?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-yellow-400">
                            <span className="text-[10px]">~{gitData.modified!.length}</span>
                          </span>
                        )}
                        {(gitData.created?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-green-400">
                            <Plus className="h-2.5 w-2.5" /><span className="text-[10px]">{gitData.created!.length}</span>
                          </span>
                        )}
                        {(gitData.deleted?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-red-400">
                            <Minus className="h-2.5 w-2.5" /><span className="text-[10px]">{gitData.deleted!.length}</span>
                          </span>
                        )}
                      </span>
                    </button>

                    {gitChangesExpanded && (
                      <div className="mt-1 space-y-0.5 ml-3">
                        {gitData.modified?.map((f) => (
                          <div key={f} className="flex items-center gap-1.5 text-[10px] text-yellow-400/80">
                            <span className="w-1 h-1 rounded-full bg-yellow-400 flex-shrink-0" />
                            <span className="truncate font-mono">{f.split('/').pop()}</span>
                          </div>
                        ))}
                        {gitData.created?.map((f) => (
                          <div key={f} className="flex items-center gap-1.5 text-[10px] text-green-400/80">
                            <Plus className="h-2.5 w-2.5 flex-shrink-0" />
                            <span className="truncate font-mono">{f.split('/').pop()}</span>
                          </div>
                        ))}
                        {gitData.deleted?.map((f) => (
                          <div key={f} className="flex items-center gap-1.5 text-[10px] text-red-400/80">
                            <Minus className="h-2.5 w-2.5 flex-shrink-0" />
                            <span className="truncate font-mono">{f.split('/').pop()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {gitData.totalChanges === 0 && (
                  <div className="text-[11px] text-text-muted">Working tree clean</div>
                )}

                {/* Quick commit */}
                {gitData.totalChanges > 0 && onGitCommit && (
                  <div className="space-y-1.5 pt-1 border-t border-border-subtle">
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
                            onGitCommit(gitData.commitMessage.trim());
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
                          onGitCommit(gitData.commitMessage.trim());
                        }
                      }}
                      disabled={!gitData.commitMessage?.trim() || gitData.committing}
                      className="w-full"
                    >
                      <GitCommit className="h-3 w-3 mr-1" />
                      {gitData.committing ? 'Committing...' : 'Commit'}
                    </Button>
                  </div>
                )}

                {/* Error */}
                {gitData.error && (
                  <div className="text-[10px] text-status-error-text">{gitData.error}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pending Changes Section */}
        {pendingDiffs.length > 0 && (
          <div className="border-b border-border-subtle">
            <button
              type="button"
              onClick={() => setDiffsCollapsed(!diffsCollapsed)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary hover:bg-state-hover transition-colors"
            >
              {diffsCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>Pending Changes</span>
              <span className="ml-auto rounded-full bg-status-warning-bg text-status-warning-text px-1.5 py-0.5 text-[10px] font-semibold">
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
                      <span className="truncate">{diff.filePath.split('/').pop()}</span>
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

        {/* Project Files Section */}
        <div>
          <button
            type="button"
            onClick={() => setFilesCollapsed(!filesCollapsed)}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary hover:bg-state-hover transition-colors"
          >
            {filesCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <span>Project Files</span>
            {fileLinks.length > 0 && (
              <span className="ml-auto text-[10px] text-text-muted">{fileLinks.length}</span>
            )}
          </button>
          {!filesCollapsed && (
            <div className="px-2 pb-2 space-y-0.5">
              {fileLinks.length === 0 ? (
                <div className="px-2 py-3 text-[11px] text-text-muted text-center">
                  Files touched by the agent will appear here.
                </div>
              ) : (
                fileLinks.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center justify-between gap-1 rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-state-hover transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <FileText className="h-3 w-3 text-text-muted flex-shrink-0" />
                      <span className="truncate" title={file.path}>{file.label}</span>
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
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
