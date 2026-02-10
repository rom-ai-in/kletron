'use client';

import React, { useMemo } from 'react';
import {
  X,
  ExternalLink,
  FileCode,
  Plus,
  Minus,
  Undo2,
  Loader2,
} from 'lucide-react';
import { Button } from '../design-system';

export interface GitDiffViewerProps {
  /** File path being diffed */
  filePath: string;
  /** Raw unified diff content */
  diffContent: string | null;
  /** Whether the diff is loading */
  loading?: boolean;
  /** Whether this is a staged diff */
  staged?: boolean;
  /** Close the diff viewer */
  onClose?: () => void;
  /** Open in external IDE */
  onOpenInIDE?: (path: string) => void;
  /** Stage this file */
  onStageFile?: (path: string) => void;
  /** Unstage this file */
  onUnstageFile?: (path: string) => void;
  /** Revert this file */
  onRevertFile?: (path: string) => void;
  className?: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLine?: number;
  newLine?: number;
}

function parseDiff(raw: string): DiffLine[] {
  if (!raw) return [];
  const lines = raw.split('\n');
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1), newLine });
      newLine++;
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1), oldLine });
      oldLine++;
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file" — skip
    } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
      // file header lines — skip
    } else {
      // context line
      result.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line, oldLine, newLine });
      oldLine++;
      newLine++;
    }
  }

  return result;
}

export function GitDiffViewer({
  filePath,
  diffContent,
  loading,
  staged,
  onClose,
  onOpenInIDE,
  onStageFile,
  onUnstageFile,
  onRevertFile,
  className = '',
}: GitDiffViewerProps) {
  const filename = filePath.split('/').pop() ?? filePath;
  const lines = useMemo(() => parseDiff(diffContent ?? ''), [diffContent]);

  const additions = lines.filter(l => l.type === 'add').length;
  const deletions = lines.filter(l => l.type === 'remove').length;

  return (
    <div className={`flex flex-col border border-border-subtle rounded-lg overflow-hidden bg-bg-surface ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-elevated/50 border-b border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
          <span className="text-xs font-medium text-text-primary truncate">{filename}</span>
          <span className="text-[10px] text-text-muted truncate">{filePath}</span>
          {staged !== undefined && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              staged ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
            }`}>
              {staged ? 'Staged' : 'Unstaged'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {additions > 0 && <span className="text-[10px] text-green-400 font-medium">+{additions}</span>}
          {deletions > 0 && <span className="text-[10px] text-red-400 font-medium">-{deletions}</span>}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Diff Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
          <span className="ml-2 text-xs text-text-muted">Loading diff...</span>
        </div>
      ) : !diffContent ? (
        <div className="px-3 py-6 text-xs text-text-muted text-center">
          No changes to display.
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] scrollbar-elegant font-mono text-[11px] leading-5">
          {lines.map((line, i) => {
            if (line.type === 'header') {
              return (
                <div key={i} className="px-2 py-0.5 text-[10px] text-blue-400 bg-blue-400/5 border-y border-border-subtle">
                  {line.content}
                </div>
              );
            }
            return (
              <div
                key={i}
                className={`flex ${
                  line.type === 'add'
                    ? 'bg-green-500/8 text-green-300'
                    : line.type === 'remove'
                      ? 'bg-red-500/8 text-red-300'
                      : 'text-text-secondary'
                }`}
              >
                {/* Old line number */}
                <span className="w-10 text-right pr-1 text-[10px] text-text-muted select-none border-r border-border-subtle flex-shrink-0">
                  {line.type !== 'add' ? line.oldLine ?? '' : ''}
                </span>
                {/* New line number */}
                <span className="w-10 text-right pr-1 text-[10px] text-text-muted select-none border-r border-border-subtle flex-shrink-0">
                  {line.type !== 'remove' ? line.newLine ?? '' : ''}
                </span>
                {/* Sign */}
                <span className="w-5 text-center flex-shrink-0 select-none">
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </span>
                {/* Content */}
                <span className="flex-1 whitespace-pre px-1">{line.content}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border-subtle bg-bg-elevated/30">
        <div className="flex items-center gap-1">
          {!staged && onStageFile && (
            <Button size="xs" variant="secondary" onClick={() => onStageFile(filePath)}>
              <Plus className="h-3 w-3 mr-1" />
              Stage
            </Button>
          )}
          {staged && onUnstageFile && (
            <Button size="xs" variant="secondary" onClick={() => onUnstageFile(filePath)}>
              <Minus className="h-3 w-3 mr-1" />
              Unstage
            </Button>
          )}
          {!staged && onRevertFile && (
            <Button size="xs" variant="ghost" onClick={() => onRevertFile(filePath)}>
              <Undo2 className="h-3 w-3 mr-1" />
              Discard
            </Button>
          )}
        </div>
        {onOpenInIDE && (
          <Button size="xs" variant="secondary" onClick={() => onOpenInIDE(filePath)}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Open in IDE
          </Button>
        )}
      </div>
    </div>
  );
}
