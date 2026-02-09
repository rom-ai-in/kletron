'use client';

import React, { useMemo, useState } from 'react';
import {
    Check,
    ChevronRight,
    Circle,
    FileText,
    FolderOpen,
    Pencil,
    Search,
    Terminal as TerminalIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
 * Helper — format JSON nicely (or return raw string)
 * ═══════════════════════════════════════════════════════════════════════════ */

function formatMaybeJson(value?: string): string {
    if (!value) return '';
    try {
        return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
        return value;
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ToolInvocationIcon — icon per tool type
 * ═══════════════════════════════════════════════════════════════════════════ */

export function ToolInvocationIcon({ name, className }: { name: string; className?: string }) {
    const cls = cn('w-3 h-3 text-text-muted shrink-0', className);
    if (name === 'run_command') return <TerminalIcon className={cls} />;
    if (name === 'grep_search' || name === 'codebase_search') return <Search className={cls} />;
    if (name === 'edit_file' || name === 'replace_file_content') return <Pencil className={cls} />;
    if (name === 'read_file' || name === 'view_file') return <FileText className={cls} />;
    if (name === 'list_dir') return <FolderOpen className={cls} />;
    if (name === 'write_file' || name === 'write_to_file') return <Pencil className={cls} />;
    return <Circle className={cls} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * getToolSummary — friendly summary from tool name + args
 * ═══════════════════════════════════════════════════════════════════════════ */

function getToolSummary(name: string, parsedArgs: Record<string, any>): string {
    if (name === 'read_file' || name === 'view_file') {
        const p = parsedArgs.path || parsedArgs.AbsolutePath || '';
        return (p as string).split('/').pop() || p;
    }
    if (name === 'grep_search' || name === 'codebase_search') {
        return parsedArgs.query || parsedArgs.Query || '';
    }
    if (name === 'edit_file' || name === 'replace_file_content') {
        const p = parsedArgs.path || parsedArgs.TargetFile || '';
        return (p as string).split('/').pop() || p;
    }
    if (name === 'run_command') {
        return parsedArgs.command || parsedArgs.CommandLine || '';
    }
    if (name === 'list_dir') {
        const p = parsedArgs.path || parsedArgs.DirectoryPath || '';
        return (p as string).split('/').pop() || p;
    }
    if (name === 'write_file' || name === 'write_to_file') {
        const p = parsedArgs.path || parsedArgs.TargetFile || '';
        return (p as string).split('/').pop() || p;
    }
    return '';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ToolInvocationDetail — expanded content, different per tool type
 * ═══════════════════════════════════════════════════════════════════════════ */

function ToolInvocationDetail({
    name,
    args,
    output,
    parsedArgs,
}: {
    name: string;
    args?: string;
    output?: string;
    parsedArgs: Record<string, any>;
}) {
    // ── run_command: terminal-style block ──
    if (name === 'run_command') {
        const command = parsedArgs.command || parsedArgs.CommandLine || '';
        const exitMatch = output?.match(/Exit code:\s*(\d+)/);
        const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : null;
        const isSuccess = exitCode === 0;

        return (
            <div className="rounded-md bg-bg-elevated border border-border-subtle overflow-hidden">
                <div className="flex items-center gap-2 px-2 py-1 border-b border-border-subtle bg-bg-surface">
                    <TerminalIcon className="w-3 h-3 text-text-muted" />
                    <span className="text-[10px] font-mono text-text-secondary flex-1 truncate">{command}</span>
                    {exitCode !== null && (
                        <span
                            className={cn(
                                'text-[9px] font-mono flex items-center gap-1',
                                isSuccess ? 'text-status-success-text' : 'text-status-error-text',
                            )}
                        >
                            {isSuccess ? <Check className="w-2.5 h-2.5" /> : null}
                            exit {exitCode}
                        </span>
                    )}
                </div>
                {output && (
                    <pre className="px-2 py-1.5 text-[10px] font-mono text-text-muted whitespace-pre-wrap max-h-32 overflow-y-auto scrollbar-elegant">
                        {output}
                    </pre>
                )}
            </div>
        );
    }

    // ── edit_file: inline diff ──
    if (name === 'edit_file' || name === 'replace_file_content') {
        const filePath = parsedArgs.path || parsedArgs.TargetFile || '';
        const oldStr: string = parsedArgs.old_string || '';
        const newStr: string = parsedArgs.new_string || '';

        return (
            <div className="rounded-md bg-bg-elevated border border-border-subtle overflow-hidden">
                <div className="flex items-center gap-2 px-2 py-1 border-b border-border-subtle bg-bg-surface">
                    <Pencil className="w-3 h-3 text-text-muted" />
                    <span className="text-[10px] font-mono text-text-secondary truncate">{filePath}</span>
                </div>
                <div className="px-2 py-1.5 text-[10px] font-mono space-y-0 max-h-40 overflow-y-auto scrollbar-elegant">
                    {oldStr &&
                        oldStr.split('\n').map((line: string, i: number) => (
                            <div key={`rm-${i}`} className="text-status-error-text bg-status-error-bg/30 px-1 rounded-sm">
                                <span className="select-none mr-2 text-[9px]">−</span>
                                {line}
                            </div>
                        ))}
                    {newStr &&
                        newStr.split('\n').map((line: string, i: number) => (
                            <div key={`add-${i}`} className="text-status-success-text bg-status-success-bg/30 px-1 rounded-sm">
                                <span className="select-none mr-2 text-[9px]">+</span>
                                {line}
                            </div>
                        ))}
                </div>
                {output && (
                    <div className="px-2 py-1 border-t border-border-subtle text-[9px] text-status-success-text flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> {output}
                    </div>
                )}
            </div>
        );
    }

    // ── grep_search: search results ──
    if (name === 'grep_search' || name === 'codebase_search') {
        const query = parsedArgs.query || parsedArgs.Query || '';
        const resultLines = output?.split('\n').filter(Boolean) ?? [];

        return (
            <div className="rounded-md bg-bg-elevated border border-border-subtle overflow-hidden">
                <div className="flex items-center gap-2 px-2 py-1 border-b border-border-subtle bg-bg-surface">
                    <Search className="w-3 h-3 text-text-muted" />
                    <span className="text-[10px] font-mono text-text-secondary">&quot;{query}&quot;</span>
                    <span className="ml-auto text-[9px] text-text-muted">{resultLines.length} results</span>
                </div>
                <div className="max-h-32 overflow-y-auto scrollbar-elegant">
                    {resultLines.map((line, i) => {
                        const parts = line.split(':');
                        const file = parts[0] || '';
                        const lineNum = parts[1] || '';
                        const text = parts.slice(2).join(':').trim();
                        return (
                            <div
                                key={i}
                                className="flex items-start gap-2 px-2 py-0.5 text-[10px] font-mono hover:bg-state-hover transition-colors"
                            >
                                <span className="text-text-muted truncate shrink-0 max-w-[180px]">{file}</span>
                                <span className="text-text-muted">:{lineNum}</span>
                                <span className="text-text-secondary truncate">{text}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Default: generic args + output ──
    return (
        <>
            {args && (
                <pre className="text-[10px] font-mono text-text-muted whitespace-pre-wrap">
                    {formatMaybeJson(args)}
                </pre>
            )}
            {output && (
                <div className="mt-1 rounded bg-bg-elevated px-2 py-1.5 text-[10px] font-mono text-text-muted whitespace-pre-wrap max-h-32 overflow-y-auto scrollbar-elegant">
                    {output}
                </div>
            )}
        </>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ToolInvocation — collapsible tool call row
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface ToolInvocationProps {
    /** Tool name (e.g. "read_file", "run_command") */
    name: string;
    /** JSON-stringified tool arguments */
    args?: string;
    /** Tool output / result text */
    output?: string;
    /** Duration / timing label (e.g. "180ms") */
    meta?: string;
    /** Whether to start expanded */
    defaultOpen?: boolean;
    /** Additional className */
    className?: string;
}

export const ToolInvocation: React.FC<ToolInvocationProps> = ({
    name,
    args,
    output,
    meta,
    defaultOpen = false,
    className,
}) => {
    const [open, setOpen] = useState(defaultOpen);

    const parsedArgs = useMemo(() => {
        try {
            return args ? JSON.parse(args) : {};
        } catch {
            return {};
        }
    }, [args]);

    const summary = useMemo(() => getToolSummary(name, parsedArgs), [name, parsedArgs]);

    return (
        <div className={cn('py-0.5 pl-1', className)}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center gap-2 w-full text-left py-0.5 hover:bg-state-hover rounded px-1 -ml-1 transition-colors"
            >
                <div className={cn('text-text-muted transition-transform duration-200', open && 'rotate-90')}>
                    <ChevronRight size={12} />
                </div>
                <ToolInvocationIcon name={name} />
                <span className="font-semibold text-[11px] text-text-secondary">{name}</span>
                {summary && (
                    <span className="text-[10px] font-mono text-text-muted truncate max-w-[240px]">{summary}</span>
                )}
                {meta && <span className="ml-auto text-[10px] font-mono text-text-muted shrink-0">{meta}</span>}
            </button>

            {open && (
                <div className="pl-5 mt-0.5 border-l border-border-subtle ml-1.5 pb-1.5">
                    <ToolInvocationDetail name={name} args={args} output={output} parsedArgs={parsedArgs} />
                </div>
            )}
        </div>
    );
};
