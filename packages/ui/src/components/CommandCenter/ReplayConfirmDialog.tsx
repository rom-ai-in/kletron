'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileEdit,
  FilePlus2,
  FileX2,
  Folder,
  FolderOpen,
  MessageSquare,
  Wrench,
  RotateCcw,
  X,
} from 'lucide-react';

export interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  /** The content written by the tool (for write_file/create). */
  newContent?: string;
  /** Pre-computed unified diff lines (if available). */
  diffLines?: string[];
}

export interface ReplayImpact {
  /** Number of messages (user + assistant text) that will be removed */
  messagesRemoved: number;
  /** Number of tool calls that will be removed */
  toolCallsRemoved: number;
  /** File changes that occurred after the edited message */
  fileChanges: FileChange[];
  /** Original message content */
  originalContent: string;
  /** New edited content */
  newContent: string;
}

export interface ReplayConfirmDialogProps {
  open: boolean;
  impact: ReplayImpact | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const fileActionIcon: Record<FileChange['action'], React.ReactNode> = {
  created: <FilePlus2 className="w-3.5 h-3.5 text-green-400" />,
  modified: <FileEdit className="w-3.5 h-3.5 text-yellow-400" />,
  deleted: <FileX2 className="w-3.5 h-3.5 text-red-400" />,
};

const fileActionLabel: Record<FileChange['action'], string> = {
  created: 'Created',
  modified: 'Modified',
  deleted: 'Deleted',
};

const fileActionColor: Record<FileChange['action'], string> = {
  created: 'text-green-400',
  modified: 'text-yellow-400',
  deleted: 'text-red-400',
};

// ─── Diff Line Renderer ──────────────────────────────────────────────────────

function DiffLineView({ line }: { line: string }) {
  const prefix = line[0] ?? ' ';
  const text = line.slice(1);

  if (prefix === '+') {
    return (
      <div className="flex font-mono text-[11px] leading-[18px]">
        <span className="w-6 text-right pr-1 text-green-500/60 select-none flex-shrink-0">+</span>
        <span className="flex-1 text-green-300 bg-green-500/8 px-1">{text || ' '}</span>
      </div>
    );
  }
  if (prefix === '-') {
    return (
      <div className="flex font-mono text-[11px] leading-[18px]">
        <span className="w-6 text-right pr-1 text-red-500/60 select-none flex-shrink-0">-</span>
        <span className="flex-1 text-red-300 bg-red-500/8 px-1">{text || ' '}</span>
      </div>
    );
  }
  if (line.startsWith('@@')) {
    return (
      <div className="flex font-mono text-[10px] leading-[16px] text-text-muted bg-white/3 py-0.5 px-1">
        {line}
      </div>
    );
  }
  return (
    <div className="flex font-mono text-[11px] leading-[18px]">
      <span className="w-6 text-right pr-1 text-text-muted/40 select-none flex-shrink-0"> </span>
      <span className="flex-1 text-text-secondary px-1">{text || ' '}</span>
    </div>
  );
}

// ─── Simple inline diff for new content (no old content available) ───────────

function NewContentPreview({ content, maxLines = 12 }: { content: string; maxLines?: number }) {
  const lines = content.split('\n');
  const truncated = lines.length > maxLines;
  const shown = truncated ? lines.slice(0, maxLines) : lines;

  return (
    <div className="font-mono text-[11px] leading-[18px] overflow-x-auto max-h-[200px] overflow-y-auto scrollbar-elegant">
      {shown.map((line, i) => (
        <div key={i} className="flex">
          <span className="w-8 text-right pr-2 text-green-500/40 select-none flex-shrink-0">{i + 1}</span>
          <span className="flex-1 text-green-300/80 px-1">{line || ' '}</span>
        </div>
      ))}
      {truncated && (
        <div className="text-[10px] text-text-muted px-2 py-1">
          … {lines.length - maxLines} more lines
        </div>
      )}
    </div>
  );
}

// ─── File Diff Card ──────────────────────────────────────────────────────────

function FileDiffCard({ fc, index }: { fc: FileChange; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const filename = fc.path.split('/').pop() ?? fc.path;
  const dirPath = fc.path.includes('/') ? fc.path.slice(0, fc.path.lastIndexOf('/')) : '';

  const hasDiff = (fc.diffLines && fc.diffLines.length > 0) || (fc.newContent && fc.action === 'created');
  const additions = fc.diffLines?.filter((l) => l.startsWith('+')).length ?? 0;
  const deletions = fc.diffLines?.filter((l) => l.startsWith('-')).length ?? 0;
  const lineCount = fc.newContent ? fc.newContent.split('\n').length : 0;

  return (
    <div className="rounded-lg border border-white/[0.06] overflow-hidden">
      {/* File header */}
      <button
        type="button"
        onClick={() => hasDiff && setExpanded(!expanded)}
        className={`flex items-center gap-2 w-full px-3 py-1.5 text-left ${
          hasDiff ? 'hover:bg-white/3 cursor-pointer' : 'cursor-default'
        } transition-colors`}
      >
        {hasDiff ? (
          expanded ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {fileActionIcon[fc.action]}
        <span className="text-xs text-text-primary font-medium truncate">{filename}</span>
        {dirPath && (
          <span className="text-[10px] text-text-muted truncate flex-1">{dirPath}/</span>
        )}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          {fc.action === 'created' && lineCount > 0 && (
            <span className="text-[10px] text-green-400">+{lineCount} lines</span>
          )}
          {fc.action === 'modified' && (additions > 0 || deletions > 0) && (
            <>
              {additions > 0 && <span className="text-[10px] text-green-400">+{additions}</span>}
              {deletions > 0 && <span className="text-[10px] text-red-400">-{deletions}</span>}
            </>
          )}
          <span className={`text-[10px] font-medium ${fileActionColor[fc.action]}`}>
            {fileActionLabel[fc.action]}
          </span>
        </div>
      </button>

      {/* Diff content */}
      {expanded && hasDiff && (
        <div className="border-t border-white/[0.06] bg-black/20 max-h-[250px] overflow-y-auto scrollbar-elegant overflow-x-auto">
          {fc.diffLines && fc.diffLines.length > 0 ? (
            fc.diffLines.map((line, i) => <DiffLineView key={i} line={line} />)
          ) : fc.newContent && fc.action === 'created' ? (
            <NewContentPreview content={fc.newContent} maxLines={20} />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Folder Tree Grouping ────────────────────────────────────────────────────

type FolderGroup = {
  folder: string;
  files: (FileChange & { originalIndex: number })[];
};

function groupByFolder(files: FileChange[]): FolderGroup[] {
  const map = new Map<string, (FileChange & { originalIndex: number })[]>();
  files.forEach((fc, i) => {
    const folder = fc.path.includes('/') ? fc.path.slice(0, fc.path.lastIndexOf('/')) : '.';
    if (!map.has(folder)) map.set(folder, []);
    map.get(folder)!.push({ ...fc, originalIndex: i });
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, files]) => ({ folder, files }));
}

function FolderGroupView({ group }: { group: FolderGroup }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      {/* Folder header — only show if more than one group or non-root */}
      {group.folder !== '.' && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full px-2 py-1 text-left hover:bg-white/3 transition-colors"
        >
          {expanded ? (
            <FolderOpen className="w-3 h-3 text-yellow-400/70 flex-shrink-0" />
          ) : (
            <Folder className="w-3 h-3 text-yellow-400/70 flex-shrink-0" />
          )}
          <span className="text-[11px] text-text-muted font-mono truncate">{group.folder}/</span>
          <span className="text-[10px] text-text-muted ml-auto flex-shrink-0">
            {group.files.length} file{group.files.length > 1 ? 's' : ''}
          </span>
        </button>
      )}
      {expanded && (
        <div className="space-y-1.5 pl-1">
          {group.files.map((fc) => (
            <FileDiffCard key={`${fc.path}-${fc.originalIndex}`} fc={fc} index={fc.originalIndex} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export function ReplayConfirmDialog({
  open,
  impact,
  onConfirm,
  onCancel,
  loading = false,
}: ReplayConfirmDialogProps) {
  if (!open || !impact) return null;

  const hasFileChanges = impact.fileChanges.length > 0;
  const hasImpact = impact.messagesRemoved > 0 || impact.toolCallsRemoved > 0 || hasFileChanges;
  const folderGroups = useMemo(
    () => hasFileChanges ? groupByFolder(impact.fileChanges) : [],
    [impact.fileChanges, hasFileChanges]
  );
  const showFolderHeaders = folderGroups.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 rounded-xl glass-elevated overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-500/10">
            <RotateCcw className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">Resend from this point</h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              The conversation will be rewound to this message
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-elegant">
          {/* Message diff */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Edited message
            </div>
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              {impact.originalContent !== impact.newContent && (
                <div className="px-3 py-2 bg-red-500/5 border-b border-white/[0.06]">
                  <div className="text-[10px] font-medium text-red-400 mb-1">Before</div>
                  <div className="text-xs text-text-muted line-through whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
                    {impact.originalContent}
                  </div>
                </div>
              )}
              <div className="px-3 py-2 bg-green-500/5">
                <div className="text-[10px] font-medium text-green-400 mb-1">After</div>
                <div className="text-xs text-text-primary whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
                  {impact.newContent}
                </div>
              </div>
            </div>
          </div>

          {/* Impact summary */}
          {hasImpact && (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                What will be removed
              </div>
              <div className="grid grid-cols-2 gap-2">
                {impact.messagesRemoved > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-2">
                    <MessageSquare className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <span className="text-xs text-text-secondary">
                      <span className="font-semibold text-text-primary">{impact.messagesRemoved}</span> message{impact.messagesRemoved > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {impact.toolCallsRemoved > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-2">
                    <Wrench className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <span className="text-xs text-text-secondary">
                      <span className="font-semibold text-text-primary">{impact.toolCallsRemoved}</span> tool call{impact.toolCallsRemoved > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* File changes with diffs */}
          {hasFileChanges && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  File changes already applied
                </div>
                <span className="text-[10px] text-text-muted">
                  {impact.fileChanges.length} file{impact.fileChanges.length > 1 ? 's' : ''}
                  {' · '}
                  {folderGroups.length} folder{folderGroups.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* File tree with expandable diffs */}
              <div className="space-y-1.5">
                {showFolderHeaders ? (
                  folderGroups.map((group) => (
                    <FolderGroupView key={group.folder} group={group} />
                  ))
                ) : (
                  impact.fileChanges.map((fc, i) => (
                    <FileDiffCard key={`${fc.path}-${i}`} fc={fc} index={i} />
                  ))
                )}
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20 px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-200/80 leading-relaxed">
                  These changes have already been applied to your files. Resending will <strong>not</strong> automatically undo them.
                </p>
              </div>
            </div>
          )}

          {/* No impact — last message */}
          {!hasImpact && (
            <div className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-text-muted">
              This is the last message in the thread — nothing will be removed.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Resending…
              </>
            ) : (
              <>
                <RotateCcw className="w-3 h-3" />
                Resend &amp; Continue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
