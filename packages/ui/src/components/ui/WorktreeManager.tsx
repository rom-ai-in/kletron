'use client';

import React, { useState } from 'react';
import { Plus, Trash2, GitBranch, FolderGit, Check, Bot, Zap } from 'lucide-react';

export interface Worktree {
    path: string;
    branch: string;
    isMain: boolean;
    /** Thread ID of the agent using this worktree */
    agentThreadId?: string;
    /** Display name of the agent using this worktree */
    agentLabel?: string;
}

export interface WorktreeManagerProps {
    worktrees: Worktree[];
    activeWorktree?: string;
    onAdd?: (path: string, branch: string) => void;
    onRemove?: (path: string) => void;
    onSwitch?: (path: string) => void;
    /** Create a worktree with auto-generated branch for an agent */
    onCreateForAgent?: (threadId: string) => void;
    className?: string;
}

export function WorktreeManager({
    worktrees,
    activeWorktree,
    onAdd,
    onRemove,
    onSwitch,
    onCreateForAgent,
    className = '',
}: WorktreeManagerProps) {
    const [showAdd, setShowAdd] = useState(false);
    const [newPath, setNewPath] = useState('');
    const [newBranch, setNewBranch] = useState('');

    function handleAdd() {
        if (!newPath.trim() || !newBranch.trim()) return;
        onAdd?.(newPath.trim(), newBranch.trim());
        setNewPath('');
        setNewBranch('');
        setShowAdd(false);
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {worktrees.map(worktree => {
                const isActive = activeWorktree === worktree.path;
                return (
                    <div
                        key={worktree.path}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                            isActive
                                ? 'border-border-strong bg-state-hover'
                                : 'border-border-subtle hover:border-border-strong'
                        }`}
                        onClick={() => onSwitch?.(worktree.path)}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <FolderGit className={`w-4 h-4 ${isActive ? 'text-status-success-text' : 'text-text-muted'}`} />
                            <div className="min-w-0">
                                <div className="text-xs font-medium text-text-primary flex items-center gap-1">
                                    <GitBranch className="w-3 h-3 text-text-muted" />
                                    {worktree.branch}
                                    {worktree.isMain && (
                                        <span className="text-[9px] bg-bg-elevated text-text-secondary px-1 rounded">main</span>
                                    )}
                                </div>
                                <div className="text-[10px] text-text-muted truncate font-mono">{worktree.path}</div>
                                {worktree.agentLabel && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <Bot className="w-2.5 h-2.5 text-blue-400" />
                                        <span className="text-[9px] text-blue-400 font-medium">{worktree.agentLabel}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {isActive && <Check className="w-4 h-4 text-status-success-text" />}
                            {worktree.agentThreadId && (
                                <span className="px-1 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <Bot className="w-2.5 h-2.5 inline" /> isolated
                                </span>
                            )}
                            {!worktree.isMain && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Remove worktree "${worktree.branch}"?`)) {
                                            onRemove?.(worktree.path);
                                        }
                                    }}
                                    className="p-1 rounded text-text-muted hover:text-status-error-text hover:bg-state-hover transition-colors"
                                    title="Remove worktree"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {worktrees.length === 0 && !showAdd && (
                <div className="rounded-md border border-border-subtle px-3 py-4 text-xs text-text-muted text-center">
                    No worktrees configured.
                </div>
            )}

            {/* Quick create for agent isolation */}
            {onCreateForAgent && (
                <button
                    type="button"
                    onClick={() => onCreateForAgent('current')}
                    className="flex items-center gap-2 w-full rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                    <Zap className="w-3.5 h-3.5" />
                    Create Isolated Worktree for Agent
                </button>
            )}

            {showAdd ? (
                <div className="rounded-md border border-border-strong bg-bg-surface p-3 space-y-2">
                    <input
                        value={newBranch}
                        onChange={(e) => setNewBranch(e.target.value)}
                        placeholder="Branch name"
                        className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                        <input
                            value={newPath}
                            onChange={(e) => setNewPath(e.target.value)}
                            placeholder="Worktree path"
                            className="flex-1 rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none font-mono"
                        />
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    const result = await (window as any).numezis?.selectWorkspace?.();
                                    if (result && result.path) {
                                        setNewPath(result.path);
                                    }
                                } catch {
                                    // ignore — user cancelled or Electron API unavailable
                                }
                            }}
                            className="px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                            title="Browse for folder"
                        >
                            Browse...
                        </button>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs text-text-muted hover:text-text-primary">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={!newPath.trim() || !newBranch.trim()}
                            className="rounded-md bg-bg-elevated border border-border-strong px-3 py-1 text-xs text-text-primary hover:bg-bg-elevated disabled:opacity-50"
                        >
                            Add Worktree
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 w-full rounded-md border border-dashed border-border-strong px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Worktree
                </button>
            )}
        </div>
    );
}
