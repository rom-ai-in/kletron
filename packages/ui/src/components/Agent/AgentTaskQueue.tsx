'use client';

import React, { useState, useMemo } from 'react';
import {
    Brain, Check, FileCode, Loader2, Plus, X, ListTodo,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentTaskStatus = 'todo' | 'in_progress' | 'done';

export interface AgentTask {
    /** Unique task identifier (matches state.taskQueue[].id) */
    id: string;
    /** Short task description */
    title: string;
    /** Current status */
    status: AgentTaskStatus;
    /** Optional file reference for context */
    file?: string;
}

export interface AgentTaskQueueProps {
    /** Task list — mirrors state.taskQueue from an agent graph run */
    tasks: AgentTask[];
    /** Called when the user cycles a task's status */
    onStatusChange?: (taskId: string, newStatus: AgentTaskStatus) => void;
    /** Called when the user adds a new task */
    onAddTask?: (title: string) => void;
    /** Called when the user removes a task */
    onRemoveTask?: (taskId: string) => void;
    /** Session label shown in the header */
    sessionLabel?: string;
    /** Session id shown as secondary text */
    sessionId?: string;
    /** Placeholder for the add-task input */
    addPlaceholder?: string;
    /** Additional className on the root element */
    className?: string;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_ORDER: AgentTaskStatus[] = ['todo', 'in_progress', 'done'];

function nextStatus(current: AgentTaskStatus): AgentTaskStatus {
    const idx = STATUS_ORDER.indexOf(current);
    return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function StatusIcon({ status }: { status: AgentTaskStatus }) {
    switch (status) {
        case 'done':
            return (
                <div className="w-3.5 h-3.5 rounded border border-status-success bg-status-success/20 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-status-success-text" />
                </div>
            );
        case 'in_progress':
            return (
                <div className="w-3.5 h-3.5 rounded border border-status-warning bg-status-warning/20 flex items-center justify-center">
                    <Loader2 className="w-2.5 h-2.5 text-status-warning-text animate-spin" />
                </div>
            );
        case 'todo':
        default:
            return <div className="w-3.5 h-3.5 rounded border border-border-strong" />;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentTaskQueue({
    tasks,
    onStatusChange,
    onAddTask,
    onRemoveTask,
    sessionLabel = 'Agent Session',
    sessionId,
    addPlaceholder = 'Add a task to the queue…',
    className = '',
}: AgentTaskQueueProps) {
    const [newTaskTitle, setNewTaskTitle] = useState('');

    const counts = useMemo(() => {
        const done = tasks.filter(t => t.status === 'done').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const todo = tasks.filter(t => t.status === 'todo').length;
        return { done, inProgress, todo, total: tasks.length };
    }, [tasks]);

    const handleAdd = () => {
        const title = newTaskTitle.trim();
        if (!title) return;
        onAddTask?.(title);
        setNewTaskTitle('');
    };

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* ── Session header ── */}
            <div className="px-3 py-2 border-b border-border-subtle bg-bg-elevated/50">
                <div className="flex items-center gap-1.5">
                    <Brain className="w-3 h-3 text-accent-primary" />
                    <span className="text-[10px] font-semibold text-text-primary truncate">
                        {sessionLabel}
                    </span>
                    {sessionId && (
                        <span className="ml-auto text-[9px] text-text-muted">{sessionId}</span>
                    )}
                </div>

                {/* Counters + progress bar */}
                <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-status-success" />
                        <span className="text-[9px] text-text-muted">{counts.done} done</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-status-warning" />
                        <span className="text-[9px] text-text-muted">{counts.inProgress} active</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-border-strong" />
                        <span className="text-[9px] text-text-muted">{counts.todo} todo</span>
                    </div>
                    <div className="ml-auto flex-shrink-0 w-12 h-1 rounded-full bg-bg-app overflow-hidden">
                        <div
                            className="h-full rounded-full bg-status-success transition-all"
                            style={{
                                width: `${counts.total > 0 ? (counts.done / counts.total) * 100 : 0}%`,
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Task list ── */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                {tasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-text-muted">
                        <ListTodo className="w-5 h-5 opacity-30 mb-2" />
                        <span className="text-[10px]">No tasks in the queue</span>
                        <span className="text-[9px] mt-0.5">The agent&apos;s write_todos tool populates this list</span>
                    </div>
                )}

                {tasks.map(task => (
                    <div
                        key={task.id}
                        className={`group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-state-hover ${
                            task.status === 'in_progress' ? 'bg-status-warning-bg/30' : ''
                        }`}
                    >
                        {/* Status indicator — click to cycle */}
                        <button
                            type="button"
                            onClick={() => onStatusChange?.(task.id, nextStatus(task.status))}
                            className="mt-0.5 flex-shrink-0"
                            title={`Status: ${task.status} (click to cycle)`}
                        >
                            <StatusIcon status={task.status} />
                        </button>

                        {/* Task content */}
                        <div className="flex-1 min-w-0">
                            <span
                                className={`text-[11px] leading-tight ${
                                    task.status === 'done'
                                        ? 'text-text-muted line-through'
                                        : task.status === 'in_progress'
                                        ? 'text-text-primary font-medium'
                                        : 'text-text-primary'
                                }`}
                            >
                                {task.title}
                            </span>
                            {task.file && (
                                <div className="flex items-center gap-1 mt-0.5">
                                    <FileCode className="w-2.5 h-2.5 text-text-muted flex-shrink-0" />
                                    <span className="text-[9px] text-text-muted truncate">{task.file}</span>
                                </div>
                            )}
                        </div>

                        {/* Remove button */}
                        {onRemoveTask && (
                            <button
                                type="button"
                                onClick={() => onRemoveTask(task.id)}
                                className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-text-primary transition-all"
                                title="Remove task"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Add task input ── */}
            {onAddTask && (
                <div className="px-2 py-2 border-t border-border-subtle">
                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            placeholder={addPlaceholder}
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                            className="flex-1 rounded-md bg-bg-app border border-border-subtle py-1.5 px-2 text-[11px] text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleAdd}
                            className="p-1.5 rounded-md bg-bg-elevated border border-border-subtle text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                            title="Add task"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="mt-1.5 text-[9px] text-text-muted">
                        Tasks from <span className="font-medium text-accent-primary">write_todos</span> tool &middot; click status to cycle
                    </div>
                </div>
            )}
        </div>
    );
}
