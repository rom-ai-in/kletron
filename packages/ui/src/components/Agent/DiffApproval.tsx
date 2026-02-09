'use client';

import React from 'react';
import { FileCode, Check, X, Eye, GitBranch, CheckCheck, XOctagon, RotateCcw } from 'lucide-react';

export type DiffState = 'pending' | 'approved' | 'rejected';

export interface DiffFile {
    id: string;
    filename: string;
    filepath?: string;
    additions: number;
    deletions: number;
    isNew?: boolean;
    isDeleted?: boolean;
    hunks?: DiffHunk[];
}

export interface DiffHunk {
    oldStart: number;
    newStart: number;
    lines: DiffLine[];
}

export interface DiffLine {
    type: 'add' | 'remove' | 'context';
    content: string;
    oldLineNumber?: number;
    newLineNumber?: number;
}

export interface DiffApprovalProps {
    files: DiffFile[];
    states: Record<string, DiffState>;
    onApprove: (fileId: string) => void;
    onReject: (fileId: string) => void;
    onApproveAll?: () => void;
    onRejectAll?: () => void;
    onReset?: () => void;
    onPreview?: (file: DiffFile) => void;
    onViewDiff?: (file: DiffFile) => void;
    showBulkActions?: boolean;
    className?: string;
}

function getStateBorderColor(state: DiffState): string {
    switch (state) {
        case 'approved': return 'border-[var(--agent-success-border)]';
        case 'rejected': return 'border-[var(--agent-error-border)]';
        default: return 'border-border-subtle';
    }
}

function getStateBgColor(state: DiffState): string {
    switch (state) {
        case 'approved': return 'bg-[var(--agent-success-bg)]';
        case 'rejected': return 'bg-[var(--agent-error-bg)]';
        default: return 'bg-bg-app';
    }
}

export function DiffApproval({
    files,
    states,
    onApprove,
    onReject,
    onApproveAll,
    onRejectAll,
    onReset,
    onPreview,
    onViewDiff,
    showBulkActions = true,
    className = '',
}: DiffApprovalProps) {
    const pendingCount = files.filter(f => states[f.id] === 'pending').length;
    const approvedCount = files.filter(f => states[f.id] === 'approved').length;
    const rejectedCount = files.filter(f => states[f.id] === 'rejected').length;

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Bulk Actions */}
            {showBulkActions && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border-subtle bg-bg-app">
                    <span className="text-xs text-text-muted mr-2">
                        {pendingCount} pending • {approvedCount} approved • {rejectedCount} rejected
                    </span>

                    <button
                        onClick={onApproveAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium 
              bg-[var(--agent-success-bg)] text-[var(--agent-success)] border border-[var(--agent-success-border)]
              hover:bg-status-success-bg transition-colors"
                    >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Approve All
                    </button>

                    <button
                        onClick={onRejectAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium 
              bg-[var(--agent-error-bg)] text-[var(--agent-error)] border border-[var(--agent-error-border)]
              hover:bg-status-error-bg transition-colors"
                    >
                        <XOctagon className="w-3.5 h-3.5" />
                        Reject All
                    </button>

                    <button
                        onClick={onReset}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium 
              bg-bg-elevated text-text-muted border border-border-subtle
              hover:bg-state-hover transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                    </button>
                </div>
            )}

            {/* Diff Cards */}
            {files.map((file) => {
                const state = states[file.id] || 'pending';
                const badge = file.isNew ? 'NEW' : file.isDeleted ? 'DEL' : `+${file.additions} -${file.deletions}`;

                return (
                    <div
                        key={file.id}
                        className={`rounded-lg overflow-hidden border transition-colors ${getStateBorderColor(state)} ${getStateBgColor(state)}`}
                    >
                        {/* File Header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                            <div className="flex items-center gap-2">
                                <FileCode className="w-4 h-4 text-text-muted" />
                                <span className="text-sm font-medium text-text-primary">{file.filename}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${file.isNew
                                    ? 'bg-status-success-bg text-status-success-text'
                                    : file.isDeleted
                                        ? 'bg-status-error-bg text-status-error-text'
                                        : 'bg-bg-elevated text-text-muted'
                                    }`}>
                                    {badge}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5">
                                {state === 'pending' ? (
                                    <>
                                        <button
                                            onClick={() => onApprove(file.id)}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                        bg-[var(--agent-success-bg)] text-[var(--agent-success)] border border-[var(--agent-success-border)]
                        hover:bg-status-success-bg transition-colors"
                                        >
                                            <Check className="w-3 h-3" />
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => onReject(file.id)}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                        bg-[var(--agent-error-bg)] text-[var(--agent-error)] border border-[var(--agent-error-border)]
                        hover:bg-status-error-bg transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                            Reject
                                        </button>
                                    </>
                                ) : (
                                    <span className={`text-[10px] font-medium uppercase ${state === 'approved' ? 'text-[var(--agent-success)]' : 'text-[var(--agent-error)]'
                                        }`}>
                                        {state === 'approved' ? '✓ Approved' : '✗ Rejected'}
                                    </span>
                                )}

                                {onPreview && (
                                    <button
                                        onClick={() => onPreview(file)}
                                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                      bg-bg-elevated text-text-muted border border-border-subtle
                      hover:bg-state-hover transition-colors"
                                    >
                                        <Eye className="w-3 h-3" />
                                    </button>
                                )}

                                {onViewDiff && (
                                    <button
                                        onClick={() => onViewDiff(file)}
                                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                      bg-bg-elevated text-text-muted border border-border-subtle
                      hover:bg-state-hover transition-colors"
                                    >
                                        <GitBranch className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Diff Preview */}
                        {file.hunks && file.hunks.length > 0 && (
                            <div className="p-3 font-mono text-[11px] leading-relaxed overflow-x-auto">
                                {file.hunks[0].lines.slice(0, 5).map((line, i) => (
                                    <div
                                        key={i}
                                        className={`px-1 -mx-1 ${line.type === 'add'
                                            ? 'text-status-success-text bg-status-success-bg'
                                            : line.type === 'remove'
                                                ? 'text-status-error-text bg-status-error-bg'
                                                : 'text-text-muted'
                                            }`}
                                    >
                                        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}{line.content}
                                    </div>
                                ))}
                                {file.hunks[0].lines.length > 5 && (
                                    <div className="text-text-muted mt-1">... {file.hunks[0].lines.length - 5} more lines</div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
