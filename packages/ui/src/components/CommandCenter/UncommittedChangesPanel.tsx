'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  ExternalLink,
  Plus,
  Minus,
  Undo2,
  FileCode,
  Loader2,
} from 'lucide-react';
import { Button } from '../design-system';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileDiffData {
  path: string;
  diff: string | null;
  loading?: boolean;
  status?: 'modified' | 'created' | 'deleted' | 'renamed' | 'untracked';
}

export interface UncommittedChangesPanelProps {
  /** List of files with their diff content */
  fileDiffs: FileDiffData[];
  /** Whether all diffs are loading */
  loading?: boolean;
  /** Close/hide the panel */
  onClose?: () => void;
  /** Open file in IDE */
  onOpenInIDE?: (path: string) => void;
  /** Stage a file */
  onStageFile?: (path: string) => void;
  /** Unstage a file */
  onUnstageFile?: (path: string) => void;
  /** Revert a file */
  onRevertFile?: (path: string) => void;
  /** Revert all */
  onRevertAll?: () => void;
  /** Stage all */
  onStageAll?: () => void;
  className?: string;
}

// ── Diff Parsing ──────────────────────────────────────────────────────────────

interface ParsedLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface ParsedHunk {
  header: string;
  lines: ParsedLine[];
  oldStart: number;
  newStart: number;
}

function parseDiffToHunks(raw: string): ParsedHunk[] {
  if (!raw) return [];
  const lines = raw.split('\n');
  const hunks: ParsedHunk[] = [];
  let currentHunk: ParsedHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
        currentHunk = {
          header: line,
          lines: [],
          oldStart: oldLine,
          newStart: newLine,
        };
        hunks.push(currentHunk);
      }
    } else if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({ type: 'add', content: line.slice(1), newLine });
        newLine++;
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({ type: 'remove', content: line.slice(1), oldLine });
        oldLine++;
      } else if (line.startsWith('\\')) {
        // skip "no newline" markers
      } else {
        currentHunk.lines.push({
          type: 'context',
          content: line.startsWith(' ') ? line.slice(1) : line,
          oldLine,
          newLine,
        });
        oldLine++;
        newLine++;
      }
    }
    // skip file headers (diff --, index, ---, +++)
  }

  return hunks;
}

function countChanges(hunks: ParsedHunk[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') additions++;
      if (line.type === 'remove') deletions++;
    }
  }
  return { additions, deletions };
}

// ── Collapsible Unmodified Lines ──────────────────────────────────────────────

function ContextBlock({ count, onExpand }: { count: number; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex items-center gap-2 w-full px-2 py-0.5 text-[10px] text-text-muted hover:bg-state-hover transition-colors border-y border-border-subtle bg-bg-app/50"
    >
      <ChevronRight className="h-2.5 w-2.5" />
      <span>{count} unmodified lines</span>
    </button>
  );
}

// ── File Diff Card ────────────────────────────────────────────────────────────

function FileDiffCard({
  file,
  onOpenInIDE,
  onStageFile,
  onRevertFile,
}: {
  file: FileDiffData;
  onOpenInIDE?: (path: string) => void;
  onStageFile?: (path: string) => void;
  onRevertFile?: (path: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedContexts, setExpandedContexts] = useState<Set<number>>(new Set());

  const hunks = useMemo(() => parseDiffToHunks(file.diff ?? ''), [file.diff]);
  const { additions, deletions } = useMemo(() => countChanges(hunks), [hunks]);
  const filename = file.path.split('/').pop() ?? file.path;

  // Group consecutive context lines to make them collapsible
  function renderHunkLines(hunkLines: ParsedLine[], hunkIdx: number) {
    const groups: Array<{ type: 'change' | 'context'; lines: ParsedLine[]; groupIdx: number }> = [];
    let contextGroup: ParsedLine[] = [];
    let groupCounter = 0;

    for (const line of hunkLines) {
      if (line.type === 'context') {
        contextGroup.push(line);
      } else {
        if (contextGroup.length > 0) {
          groups.push({ type: 'context', lines: contextGroup, groupIdx: groupCounter++ });
          contextGroup = [];
        }
        // Add change lines individually
        if (groups.length > 0 && groups[groups.length - 1].type === 'change') {
          groups[groups.length - 1].lines.push(line);
        } else {
          groups.push({ type: 'change', lines: [line], groupIdx: groupCounter++ });
        }
      }
    }
    if (contextGroup.length > 0) {
      groups.push({ type: 'context', lines: contextGroup, groupIdx: groupCounter });
    }

    return groups.map((group) => {
      const key = `${hunkIdx}-${group.groupIdx}`;
      if (group.type === 'context' && group.lines.length > 3) {
        const contextKey = hunkIdx * 1000 + group.groupIdx;
        if (expandedContexts.has(contextKey)) {
          return (
            <div key={key}>
              {group.lines.map((line, li) => (
                <DiffLineRow key={`${key}-${li}`} line={line} />
              ))}
            </div>
          );
        }
        return (
          <ContextBlock
            key={key}
            count={group.lines.length}
            onExpand={() => setExpandedContexts(prev => new Set([...prev, contextKey]))}
          />
        );
      }
      return (
        <div key={key}>
          {group.lines.map((line, li) => (
            <DiffLineRow key={`${key}-${li}`} line={line} />
          ))}
        </div>
      );
    });
  }

  if (file.loading) {
    return (
      <div className="border-b border-border-subtle">
        <div className="flex items-center gap-2 px-3 py-2">
          <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
          <span className="text-[11px] font-mono text-text-muted">{file.path}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border-subtle">
      {/* File Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-elevated/40 sticky top-0 z-10">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 min-w-0 flex-1"
        >
          {collapsed ? <ChevronRight className="h-3 w-3 text-text-muted flex-shrink-0" /> : <ChevronDown className="h-3 w-3 text-text-muted flex-shrink-0" />}
          <span className="text-[12px] font-medium text-text-primary truncate">{file.path}</span>
          {additions > 0 && <span className="text-[10px] text-green-400 font-semibold flex-shrink-0">+{additions}</span>}
          {deletions > 0 && <span className="text-[10px] text-red-400 font-semibold flex-shrink-0">-{deletions}</span>}
        </button>
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          {onOpenInIDE && (
            <button
              type="button"
              onClick={() => onOpenInIDE(file.path)}
              className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
              title="Open in IDE"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
          {onRevertFile && (
            <button
              type="button"
              onClick={() => onRevertFile(file.path)}
              className="p-0.5 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Discard changes"
            >
              <Undo2 className="h-3 w-3" />
            </button>
          )}
          {onStageFile && (
            <button
              type="button"
              onClick={() => onStageFile(file.path)}
              className="p-0.5 rounded text-text-muted hover:text-green-400 hover:bg-green-400/10 transition-colors"
              title="Stage file"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Diff Content */}
      {!collapsed && hunks.length > 0 && (
        <div className="font-mono text-[11px] leading-5 overflow-x-auto">
          {hunks.map((hunk, hi) => (
            <div key={hi}>
              {renderHunkLines(hunk.lines, hi)}
            </div>
          ))}
        </div>
      )}

      {!collapsed && hunks.length === 0 && file.diff !== null && (
        <div className="px-3 py-2 text-[11px] text-text-muted">No diff available</div>
      )}
    </div>
  );
}

// ── Diff Line ─────────────────────────────────────────────────────────────────

function DiffLineRow({ line }: { line: ParsedLine }) {
  return (
    <div
      className={`flex ${
        line.type === 'add'
          ? 'bg-green-500/8 text-green-300'
          : line.type === 'remove'
            ? 'bg-red-500/8 text-red-300'
            : 'text-text-secondary'
      }`}
    >
      <span className="w-10 text-right pr-1 text-[10px] text-text-muted/60 select-none border-r border-border-subtle/50 flex-shrink-0">
        {line.type !== 'add' ? line.oldLine ?? '' : ''}
      </span>
      <span className="w-10 text-right pr-1 text-[10px] text-text-muted/60 select-none border-r border-border-subtle/50 flex-shrink-0">
        {line.type !== 'remove' ? line.newLine ?? '' : ''}
      </span>
      <span className={`w-5 text-center flex-shrink-0 select-none ${
        line.type === 'add' ? 'text-green-400' : line.type === 'remove' ? 'text-red-400' : 'text-text-muted/40'
      }`}>
        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
      </span>
      <span className="flex-1 whitespace-pre px-1">{line.content}</span>
    </div>
  );
}

// ── Main Panel Component ──────────────────────────────────────────────────────

export function UncommittedChangesPanel({
  fileDiffs,
  loading,
  onClose,
  onOpenInIDE,
  onStageFile,
  onUnstageFile,
  onRevertFile,
  onRevertAll,
  onStageAll,
  className = '',
}: UncommittedChangesPanelProps) {
  const totalFiles = fileDiffs.length;
  const totalAdditions = useMemo(() =>
    fileDiffs.reduce((sum, f) => {
      const hunks = parseDiffToHunks(f.diff ?? '');
      return sum + countChanges(hunks).additions;
    }, 0),
  [fileDiffs]);
  const totalDeletions = useMemo(() =>
    fileDiffs.reduce((sum, f) => {
      const hunks = parseDiffToHunks(f.diff ?? '');
      return sum + countChanges(hunks).deletions;
    }, 0),
  [fileDiffs]);

  return (
    <div className={`flex flex-col h-full glass ${className}`}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[13px] font-semibold text-text-primary">Uncommitted changes</span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] text-[11px] font-mono">
            <span className="text-text-muted">{totalFiles}</span>
            {totalAdditions > 0 && <span className="text-green-400">+{totalAdditions.toLocaleString()}</span>}
            {totalDeletions > 0 && <span className="text-red-400">-{totalDeletions.toLocaleString()}</span>}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150"
            title="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── File Diffs ── */}
      <div className="flex-1 overflow-y-auto scrollbar-elegant">
        {loading && fileDiffs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
            <span className="ml-2 text-xs text-text-muted">Loading diffs...</span>
          </div>
        ) : fileDiffs.length === 0 ? (
          <div className="px-3 py-8 text-xs text-text-muted text-center">
            No uncommitted changes
          </div>
        ) : (
          fileDiffs.map((file) => (
            <FileDiffCard
              key={file.path}
              file={file}
              onOpenInIDE={onOpenInIDE}
              onStageFile={onStageFile}
              onRevertFile={onRevertFile}
            />
          ))
        )}
      </div>

      {/* ── Bottom Actions ── */}
      {fileDiffs.length > 0 && (onRevertAll || onStageAll) && (
        <div className="flex items-center justify-center gap-3 px-3 py-2 border-t border-border-subtle bg-bg-elevated/30 flex-shrink-0">
          {onRevertAll && (
            <Button size="xs" variant="ghost" onClick={onRevertAll}>
              <Undo2 className="h-3 w-3 mr-1" />
              Revert all
            </Button>
          )}
          {onStageAll && (
            <Button size="xs" variant="secondary" onClick={onStageAll}>
              <Plus className="h-3 w-3 mr-1" />
              Stage all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
