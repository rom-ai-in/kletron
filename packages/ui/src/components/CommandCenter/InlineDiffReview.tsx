'use client';

import React, { useState } from 'react';
import { Check, X, MessageSquare, ExternalLink, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Button } from '../design-system';

export interface DiffHunk {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface InlineDiff {
  editId: string;
  filePath: string;
  hunks: DiffHunk[];
}

export interface InlineDiffReviewProps {
  diffs: InlineDiff[];
  onAccept?: (editId: string) => void;
  onReject?: (editId: string) => void;
  onOpenInIDE?: (filePath: string) => void;
  onRequestIteration?: (editId: string, comment: string) => void;
  className?: string;
}

function DiffLine({ line }: { line: string }) {
  const prefix = line[0];
  const text = line.slice(1);

  if (prefix === '+') {
    return (
      <div className="flex">
        <span className="w-8 text-right pr-2 text-[10px] text-status-success-text select-none">+</span>
        <span className="flex-1 text-status-success-text bg-status-success/10 px-1">{text}</span>
      </div>
    );
  }
  if (prefix === '-') {
    return (
      <div className="flex">
        <span className="w-8 text-right pr-2 text-[10px] text-status-error-text select-none">-</span>
        <span className="flex-1 text-status-error-text bg-status-error/10 px-1">{text}</span>
      </div>
    );
  }
  return (
    <div className="flex">
      <span className="w-8 text-right pr-2 text-[10px] text-text-muted select-none"> </span>
      <span className="flex-1 text-text-secondary px-1">{text}</span>
    </div>
  );
}

function DiffCard({
  diff,
  onAccept,
  onReject,
  onOpenInIDE,
  onRequestIteration,
}: {
  diff: InlineDiff;
  onAccept?: (editId: string) => void;
  onReject?: (editId: string) => void;
  onOpenInIDE?: (filePath: string) => void;
  onRequestIteration?: (editId: string, comment: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState('');

  const filename = diff.filePath.split('/').pop() ?? diff.filePath;
  const totalAdditions = diff.hunks.reduce(
    (sum, h) => sum + h.lines.filter((l) => l.startsWith('+')).length,
    0
  );
  const totalDeletions = diff.hunks.reduce(
    (sum, h) => sum + h.lines.filter((l) => l.startsWith('-')).length,
    0
  );

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
      {/* File Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-elevated/50 border-b border-border-subtle">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-text-primary hover:text-text-primary"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <FileText className="h-3 w-3 text-text-muted" />
          <span>{filename}</span>
          <span className="text-[10px] text-text-muted font-normal ml-1">{diff.filePath}</span>
        </button>
        <div className="flex items-center gap-2 text-[10px]">
          {totalAdditions > 0 && <span className="text-status-success-text">+{totalAdditions}</span>}
          {totalDeletions > 0 && <span className="text-status-error-text">-{totalDeletions}</span>}
        </div>
      </div>

      {/* Diff Content */}
      {expanded && (
        <div className="font-mono text-[11px] leading-relaxed overflow-x-auto scrollbar-elegant">
          {diff.hunks.map((hunk) => (
            <div key={hunk.id} className="border-b border-border-subtle last:border-b-0">
              <div className="px-2 py-0.5 text-[10px] text-text-muted bg-bg-elevated/30">
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </div>
              {hunk.lines
                .filter((l) => !l.startsWith('\\'))
                .map((line, i) => (
                  <DiffLine key={`${hunk.id}-${i}`} line={line} />
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border-subtle bg-bg-elevated/30">
        <div className="flex items-center gap-1.5">
          <Button size="xs" onClick={() => onAccept?.(diff.editId)}>
            <Check className="h-3 w-3 mr-1" />
            Accept
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onReject?.(diff.editId)}>
            <X className="h-3 w-3 mr-1" />
            Reject
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setCommentOpen(!commentOpen)}
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            Comment
          </Button>
          {onOpenInIDE && (
            <Button
              size="xs"
              variant="secondary"
              onClick={() => onOpenInIDE(diff.filePath)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in IDE
            </Button>
          )}
        </div>
      </div>

      {/* Comment input */}
      {commentOpen && (
        <div className="px-3 py-2 border-t border-border-subtle bg-bg-app">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Describe the changes you want..."
            className="w-full rounded-md border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted resize-none focus:border-border-strong focus:outline-none"
            rows={2}
          />
          <div className="flex justify-end mt-1.5">
            <Button
              size="xs"
              disabled={!comment.trim()}
              onClick={() => {
                onRequestIteration?.(diff.editId, comment.trim());
                setComment('');
                setCommentOpen(false);
              }}
            >
              Request Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function InlineDiffReview({
  diffs,
  onAccept,
  onReject,
  onOpenInIDE,
  onRequestIteration,
  className = '',
}: InlineDiffReviewProps) {
  if (diffs.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
        <span>Proposed Changes</span>
        <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">{diffs.length} file(s)</span>
      </div>
      {diffs.map((diff) => (
        <DiffCard
          key={diff.editId}
          diff={diff}
          onAccept={onAccept}
          onReject={onReject}
          onOpenInIDE={onOpenInIDE}
          onRequestIteration={onRequestIteration}
        />
      ))}
    </div>
  );
}
