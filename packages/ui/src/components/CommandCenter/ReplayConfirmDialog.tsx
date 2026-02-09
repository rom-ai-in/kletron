'use client';

import React from 'react';
import {
  AlertTriangle,
  FileEdit,
  FilePlus2,
  FileX2,
  MessageSquare,
  Wrench,
  RotateCcw,
  X,
} from 'lucide-react';

export interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-xl glass-elevated overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-glass-border">
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
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-elegant">
          {/* Message diff */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Edited message
            </div>
            <div className="rounded-lg border border-glass-border overflow-hidden">
              {impact.originalContent !== impact.newContent && (
                <div className="px-3 py-2 bg-red-500/5 border-b border-glass-border">
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
                  <div className="flex items-center gap-2 rounded-lg border border-glass-border px-3 py-2">
                    <MessageSquare className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <span className="text-xs text-text-secondary">
                      <span className="font-semibold text-text-primary">{impact.messagesRemoved}</span> message{impact.messagesRemoved > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {impact.toolCallsRemoved > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-glass-border px-3 py-2">
                    <Wrench className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <span className="text-xs text-text-secondary">
                      <span className="font-semibold text-text-primary">{impact.toolCallsRemoved}</span> tool call{impact.toolCallsRemoved > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* File changes */}
          {hasFileChanges && (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                File changes already applied
              </div>
              <div className="rounded-lg border border-glass-border divide-y divide-glass-border max-h-40 overflow-y-auto scrollbar-elegant">
                {impact.fileChanges.map((fc, i) => (
                  <div key={`${fc.path}-${i}`} className="flex items-center gap-2 px-3 py-1.5">
                    {fileActionIcon[fc.action]}
                    <span className="text-xs text-text-secondary font-mono truncate flex-1">{fc.path}</span>
                    <span className={`text-[10px] font-medium ${
                      fc.action === 'created' ? 'text-green-400' : fc.action === 'deleted' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {fileActionLabel[fc.action]}
                    </span>
                  </div>
                ))}
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
            <div className="rounded-lg border border-glass-border px-3 py-2 text-xs text-text-muted">
              This is the last message in the thread — nothing will be removed.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-glass-border">
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
