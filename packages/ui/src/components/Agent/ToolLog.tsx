'use client';

import React, { useState } from 'react';
import {
    Wrench, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2,
    Search, Code2, Folder, Terminal, FileText, GitBranch, Eye, Database
} from 'lucide-react';

export type ToolStatus = 'running' | 'success' | 'error' | 'pending';

export interface ToolCall {
    id: string;
    name: string;
    args?: string;
    status: ToolStatus;
    duration?: number;
    output?: string;
}

export interface ToolLogProps {
    /** Tool calls to display */
    tools: ToolCall[];
    /** Whether the container is expanded */
    defaultExpanded?: boolean;
    /** Title shown in header */
    title?: string;
    className?: string;
}

// Get icon for tool type
function getToolIcon(toolName: string): React.ReactNode {
    const name = toolName.toLowerCase();

    if (name.includes('read') || name.includes('search')) {
        return <Search className="w-3 h-3 text-[var(--agent-tool)]" />;
    }
    if (name.includes('edit') || name.includes('write') || name.includes('code')) {
        return <Code2 className="w-3 h-3 text-[var(--agent-tool)]" />;
    }
    if (name.includes('list') || name.includes('dir') || name.includes('folder')) {
        return <Folder className="w-3 h-3 text-[var(--agent-tool)]" />;
    }
    if (name.includes('run') || name.includes('exec') || name.includes('command') || name.includes('terminal')) {
        return <Terminal className="w-3 h-3 text-[var(--agent-tool)]" />;
    }
    if (name.includes('file')) {
        return <FileText className="w-3 h-3 text-[var(--agent-tool)]" />;
    }
    if (name.includes('git') || name.includes('diff')) {
        return <GitBranch className="w-3 h-3 text-[var(--agent-tool)]" />;
    }
    if (name.includes('view') || name.includes('preview')) {
        return <Eye className="w-3 h-3 text-[var(--agent-tool)]" />;
    }
    if (name.includes('db') || name.includes('query') || name.includes('database')) {
        return <Database className="w-3 h-3 text-[var(--agent-tool)]" />;
    }

    return <Wrench className="w-3 h-3 text-[var(--agent-tool)]" />;
}

// Get status icon
function getStatusIcon(status: ToolStatus): React.ReactNode {
    switch (status) {
        case 'success':
            return <CheckCircle2 className="w-3 h-3 text-[var(--agent-success)]" />;
        case 'error':
            return <XCircle className="w-3 h-3 text-[var(--agent-error)]" />;
        case 'running':
            return <Loader2 className="w-3 h-3 text-[var(--agent-running)] animate-spin" />;
        case 'pending':
        default:
            return <div className="w-3 h-3 rounded-full border border-border-strong" />;
    }
}

export function ToolLog({
    tools,
    defaultExpanded = true,
    title,
    className = '',
}: ToolLogProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const runningCount = tools.filter(t => t.status === 'running').length;
    const successCount = tools.filter(t => t.status === 'success').length;
    const errorCount = tools.filter(t => t.status === 'error').length;

    const headerTitle = title || `Tools (${tools.length})`;

    return (
        <div
            className={`rounded-lg overflow-hidden border border-[var(--agent-tool-border)] bg-[var(--agent-tool-bg)] ${className}`}
        >
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--agent-tool-bg)]"
            >
                <Wrench className="w-4 h-4 text-[var(--agent-tool)]" />

                <span className="flex-1 text-xs font-medium text-[var(--agent-tool-text)]">
                    {headerTitle}
                </span>

                {/* Status summary */}
                <div className="flex items-center gap-1.5 text-[10px]">
                    {runningCount > 0 && (
                        <span className="text-[var(--agent-running)]">{runningCount} running</span>
                    )}
                    {successCount > 0 && (
                        <span className="text-[var(--agent-success)]">✓{successCount}</span>
                    )}
                    {errorCount > 0 && (
                        <span className="text-[var(--agent-error)]">✗{errorCount}</span>
                    )}
                </div>

                {isExpanded
                    ? <ChevronDown className="w-3 h-3 text-[var(--agent-tool-text)]" />
                    : <ChevronRight className="w-3 h-3 text-[var(--agent-tool-text)]" />
                }
            </button>

            {/* Tool list */}
            {isExpanded && (
                <div className="px-2 pb-2 space-y-1">
                    {tools.map((tool) => (
                        <div
                            key={tool.id}
                            className="flex items-center gap-2 py-1.5 px-2 rounded bg-bg-elevated/50 text-[10px]"
                        >
                            {getToolIcon(tool.name)}

                            <span className="text-text-secondary font-medium">{tool.name}</span>

                            {tool.args && (
                                <span className="flex-1 text-text-muted truncate">{tool.args}</span>
                            )}

                            {tool.duration !== undefined && (
                                <span className="text-text-muted">{tool.duration}ms</span>
                            )}

                            <span className="ml-auto">
                                {getStatusIcon(tool.status)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
