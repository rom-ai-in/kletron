'use client';

import React, { useState } from 'react';
import {
    GitBranch, RefreshCw, ChevronDown, ChevronRight,
    FileEdit, FilePlus, FileX, ArrowRightLeft, Sparkles
} from 'lucide-react';

export interface GitStatusData {
    branch: string;
    ahead: number;
    behind: number;
    modified: string[];
    created: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
}

export interface GitPanelProps {
    status: GitStatusData | null;
    branches?: string[];
    loading?: boolean;
    commitMessage?: string;
    onCommitMessageChange?: (message: string) => void;
    onCommit?: (message: string) => void;
    onBranchSwitch?: (branch: string) => void;
    onBranchCreate?: (name: string) => void;
    onFileClick?: (path: string) => void;
    onRefresh?: () => void;
    onGenerateMessage?: () => void;
    committing?: boolean;
    generatingMessage?: boolean;
    className?: string;
}

// ------ Exported Sub-Components ------

export function GitBranchSelector({
    currentBranch,
    branches = [],
    onBranchSwitch,
    onBranchCreate,
    className = '',
}: {
    currentBranch?: string;
    branches?: string[];
    onBranchSwitch?: (branch: string) => void;
    onBranchCreate?: (name: string) => void;
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-xs text-text-primary hover:bg-state-hover transition-colors"
            >
                <GitBranch className="w-3.5 h-3.5 text-text-muted" />
                <span className="truncate max-w-[140px]">{currentBranch || 'No branch'}</span>
                <ChevronDown className="w-3 h-3 text-text-muted" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setShowCreate(false); }} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-md border border-border-strong bg-bg-surface shadow-xl max-h-60 overflow-y-auto">
                        {branches.map(branch => (
                            <button
                                key={branch}
                                type="button"
                                onClick={() => {
                                    onBranchSwitch?.(branch);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center justify-between w-full px-3 py-1.5 text-xs transition-colors ${
                                    branch === currentBranch
                                        ? 'bg-bg-elevated text-text-primary'
                                        : 'text-text-secondary hover:bg-state-hover hover:text-text-primary'
                                }`}
                            >
                                <span className="flex items-center gap-2">
                                    <GitBranch className="w-3 h-3" />
                                    {branch}
                                </span>
                            </button>
                        ))}
                        <div className="border-t border-border-subtle">
                            {showCreate ? (
                                <div className="px-3 py-2 flex items-center gap-2">
                                    <input
                                        value={newBranchName}
                                        onChange={(e) => setNewBranchName(e.target.value)}
                                        placeholder="New branch..."
                                        className="flex-1 rounded-md bg-bg-elevated border border-border-strong px-2 py-1 text-xs text-text-primary focus:border-border-strong focus:outline-none"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newBranchName.trim()) {
                                                onBranchCreate?.(newBranchName.trim());
                                                setNewBranchName('');
                                                setShowCreate(false);
                                                setIsOpen(false);
                                            }
                                            if (e.key === 'Escape') {
                                                setShowCreate(false);
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(true)}
                                    className="w-full px-3 py-1.5 text-xs text-text-muted hover:bg-state-hover hover:text-text-primary text-left"
                                >
                                    + Create new branch
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export function GitChangedFiles({
    status,
    onFileClick,
    className = '',
}: {
    status: GitStatusData | null;
    onFileClick?: (path: string) => void;
    className?: string;
}) {
    const [expanded, setExpanded] = useState(true);
    const totalChanges = status
        ? status.modified.length + status.created.length + status.deleted.length + status.renamed.length
        : 0;

    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary"
            >
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Changes ({totalChanges})
            </button>

            {expanded && status && (
                <div className="space-y-0.5 px-1">
                    {status.modified.map(path => (
                        <FileRow key={`m-${path}`} path={path} type="modified" onClick={onFileClick} />
                    ))}
                    {status.created.map(path => (
                        <FileRow key={`c-${path}`} path={path} type="created" onClick={onFileClick} />
                    ))}
                    {status.deleted.map(path => (
                        <FileRow key={`d-${path}`} path={path} type="deleted" onClick={onFileClick} />
                    ))}
                    {status.renamed.map(({ from, to }) => (
                        <FileRow key={`r-${from}`} path={`${from} → ${to}`} type="renamed" onClick={onFileClick} />
                    ))}
                    {totalChanges === 0 && (
                        <div className="px-3 py-2 text-xs text-text-muted">No changes</div>
                    )}
                </div>
            )}
        </div>
    );
}

export function GitCommitForm({
    commitMessage = '',
    onCommitMessageChange,
    onCommit,
    onGenerateMessage,
    committing,
    generatingMessage,
    totalChanges = 0,
    className = '',
}: {
    commitMessage?: string;
    onCommitMessageChange?: (message: string) => void;
    onCommit?: (message: string) => void;
    onGenerateMessage?: () => void;
    committing?: boolean;
    generatingMessage?: boolean;
    totalChanges?: number;
    className?: string;
}) {
    return (
        <div className={`space-y-2 ${className}`}>
            <div className="relative">
                <textarea
                    value={commitMessage}
                    onChange={(e) => onCommitMessageChange?.(e.target.value)}
                    placeholder="Commit message..."
                    rows={3}
                    className="w-full rounded-md bg-bg-surface border border-border-subtle px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none resize-none"
                />
                {onGenerateMessage && (
                    <button
                        type="button"
                        onClick={onGenerateMessage}
                        disabled={generatingMessage}
                        className="absolute right-2 bottom-2 p-1 rounded text-text-muted hover:text-status-warning-text hover:bg-state-hover transition-colors disabled:opacity-50"
                        title="Generate commit message with AI"
                    >
                        <Sparkles className={`w-3.5 h-3.5 ${generatingMessage ? 'animate-pulse' : ''}`} />
                    </button>
                )}
            </div>
            <button
                type="button"
                onClick={() => onCommit?.(commitMessage)}
                disabled={!commitMessage.trim() || committing || totalChanges === 0}
                className="w-full rounded-md bg-bg-elevated border border-border-strong px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-state-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {committing ? 'Committing...' : `Commit ${totalChanges > 0 ? `(${totalChanges})` : ''}`}
            </button>
        </div>
    );
}

// ------ Internal Helpers ------

function StatusIcon({ type }: { type: 'modified' | 'created' | 'deleted' | 'renamed' }) {
    switch (type) {
        case 'modified': return <FileEdit className="w-3.5 h-3.5 text-status-warning-text" />;
        case 'created': return <FilePlus className="w-3.5 h-3.5 text-status-success-text" />;
        case 'deleted': return <FileX className="w-3.5 h-3.5 text-status-error-text" />;
        case 'renamed': return <ArrowRightLeft className="w-3.5 h-3.5 text-status-info-text" />;
    }
}

function StatusBadge({ type }: { type: 'modified' | 'created' | 'deleted' | 'renamed' }) {
    const labels: Record<string, string> = { modified: 'M', created: 'A', deleted: 'D', renamed: 'R' };
    const colors: Record<string, string> = {
        modified: 'text-status-warning-text', created: 'text-status-success-text',
        deleted: 'text-status-error-text', renamed: 'text-status-info-text',
    };
    return <span className={`text-[10px] font-mono font-bold ${colors[type]}`}>{labels[type]}</span>;
}

export function GitPanel({
    status,
    branches = [],
    loading,
    commitMessage = '',
    onCommitMessageChange,
    onCommit,
    onBranchSwitch,
    onBranchCreate,
    onFileClick,
    onRefresh,
    onGenerateMessage,
    committing,
    generatingMessage,
    className = '',
}: GitPanelProps) {
    const [changesExpanded, setChangesExpanded] = useState(true);
    const [newBranchName, setNewBranchName] = useState('');
    const [showNewBranch, setShowNewBranch] = useState(false);

    const totalChanges = status
        ? status.modified.length + status.created.length + status.deleted.length + status.renamed.length
        : 0;

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Branch Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                <div className="flex items-center gap-2 text-xs text-text-primary">
                    <GitBranch className="w-3.5 h-3.5 text-text-muted" />
                    <span className="font-medium">{status?.branch || 'No branch'}</span>
                    {status && (status.ahead > 0 || status.behind > 0) && (
                        <span className="text-[10px] text-text-muted">
                            {status.ahead > 0 && `+${status.ahead}`}
                            {status.ahead > 0 && status.behind > 0 && ' / '}
                            {status.behind > 0 && `-${status.behind}`}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Commit Form */}
            <div className="px-3 py-2 border-b border-border-subtle space-y-2">
                <div className="relative">
                    <textarea
                        value={commitMessage}
                        onChange={(e) => onCommitMessageChange?.(e.target.value)}
                        placeholder="Commit message..."
                        rows={3}
                        className="w-full rounded-md bg-bg-surface border border-border-subtle px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none resize-none"
                    />
                    {onGenerateMessage && (
                        <button
                            type="button"
                            onClick={onGenerateMessage}
                            disabled={generatingMessage}
                            className="absolute right-2 bottom-2 p-1 rounded text-text-muted hover:text-status-warning-text hover:bg-state-hover transition-colors disabled:opacity-50"
                            title="Generate commit message with AI"
                        >
                            <Sparkles className={`w-3.5 h-3.5 ${generatingMessage ? 'animate-pulse' : ''}`} />
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => onCommit?.(commitMessage)}
                    disabled={!commitMessage.trim() || committing || totalChanges === 0}
                    className="w-full rounded-md bg-bg-elevated border border-border-strong px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-state-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {committing ? 'Committing...' : `Commit ${totalChanges > 0 ? `(${totalChanges})` : ''}`}
                </button>
            </div>

            {/* Changed Files */}
            <div className="flex-1 overflow-y-auto">
                <button
                    type="button"
                    onClick={() => setChangesExpanded(!changesExpanded)}
                    className="flex items-center gap-1 w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary"
                >
                    {changesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Changes ({totalChanges})
                </button>

                {changesExpanded && status && (
                    <div className="space-y-0.5 px-1">
                        {status.modified.map(path => (
                            <FileRow key={`m-${path}`} path={path} type="modified" onClick={onFileClick} />
                        ))}
                        {status.created.map(path => (
                            <FileRow key={`c-${path}`} path={path} type="created" onClick={onFileClick} />
                        ))}
                        {status.deleted.map(path => (
                            <FileRow key={`d-${path}`} path={path} type="deleted" onClick={onFileClick} />
                        ))}
                        {status.renamed.map(({ from, to }) => (
                            <FileRow key={`r-${from}`} path={`${from} → ${to}`} type="renamed" onClick={onFileClick} />
                        ))}
                        {totalChanges === 0 && (
                            <div className="px-3 py-2 text-xs text-text-muted">No changes</div>
                        )}
                    </div>
                )}
            </div>

            {/* New Branch */}
            {showNewBranch && (
                <div className="px-3 py-2 border-t border-border-subtle flex items-center gap-2">
                    <input
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        placeholder="Branch name..."
                        className="flex-1 rounded-md bg-bg-surface border border-border-subtle px-2 py-1 text-xs text-text-primary focus:border-border-strong focus:outline-none"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newBranchName.trim()) {
                                onBranchCreate?.(newBranchName.trim());
                                setNewBranchName('');
                                setShowNewBranch(false);
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowNewBranch(false)}
                        className="text-xs text-text-muted hover:text-text-primary"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}

function FileRow({ path, type, onClick }: { path: string; type: 'modified' | 'created' | 'deleted' | 'renamed'; onClick?: (path: string) => void }) {
    const filename = path.split('/').pop() || path;
    return (
        <button
            type="button"
            onClick={() => onClick?.(path)}
            className="flex items-center gap-2 w-full rounded-md px-2 py-1 text-left hover:bg-state-hover transition-colors group"
        >
            <StatusIcon type={type} />
            <span className="flex-1 text-xs text-text-primary truncate">{filename}</span>
            <StatusBadge type={type} />
        </button>
    );
}

// Compact git status for the StatusBar
export function GitStatusBar({ branch, ahead, behind, changes }: {
    branch?: string;
    ahead?: number;
    behind?: number;
    changes?: number;
}) {
    if (!branch) return null;
    return (
        <span className="flex items-center gap-1 text-[11px]">
            <GitBranch className="w-3 h-3" />
            <span>{branch}</span>
            {(ahead ?? 0) > 0 && <span className="text-status-success-text">↑{ahead}</span>}
            {(behind ?? 0) > 0 && <span className="text-status-warning-text">↓{behind}</span>}
            {(changes ?? 0) > 0 && <span className="text-text-muted">({changes})</span>}
        </span>
    );
}
