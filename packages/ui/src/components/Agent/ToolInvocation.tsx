'use client';

import React, { useMemo, useState } from 'react';
import {
    Check,
    ChevronRight,
    Circle,
    FileText,
    FolderOpen,
    GitBranch,
    Globe,
    LayoutList,
    Package,
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
    // Terminal / execution
    if (name === 'run_command' || name === 'execute_bash') return <TerminalIcon className={cls} />;
    // Search tools
    if (['grep_search', 'codebase_search', 'search_code', 'todo_search', 'semantic_code_search',
         'find_symbol', 'go_to_definition', 'references', 'find_references',
         'structural_search', 'locate_ui_feature'].includes(name))
        return <Search className={cls} />;
    // Edit / write tools
    if (['edit_file', 'replace_file_content', 'write_file', 'write_to_file', 'str_replace_editor',
         'write_todos', 'add_heading', 'add_paragraph', 'add_bullet_list', 'add_table',
         'create_document', 'save_document'].includes(name))
        return <Pencil className={cls} />;
    // Read / view tools
    if (['read_file', 'view_file', 'read_file_range', 'list_word_templates'].includes(name))
        return <FileText className={cls} />;
    // Directory / structure tools
    if (['list_dir', 'list_files', 'describe_structure', 'symbols_list',
         'bootstrap_context'].includes(name))
        return <FolderOpen className={cls} />;
    // Git tools
    if (['git_log', 'git_diff', 'git_blame', 'git_grep'].includes(name))
        return <GitBranch className={cls} />;
    // Web / fetch tools
    if (['web_search', 'fetch_url', 'github_api'].includes(name))
        return <Globe className={cls} />;
    // Metrics / dependency info
    if (['repo_metrics', 'dependency_info'].includes(name))
        return <Package className={cls} />;
    // Output format
    if (name === 'output_format') return <LayoutList className={cls} />;
    return <Circle className={cls} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * getToolSummary — friendly summary from tool name + args
 * ═══════════════════════════════════════════════════════════════════════════ */

function getToolSummary(name: string, parsedArgs: Record<string, any>): string {
    // Helper: extract filename from path
    const filename = (p: string) => (p ? p.split('/').pop() || p : '');

    // File read/view
    if (['read_file', 'view_file', 'read_file_range'].includes(name)) {
        return filename(parsedArgs.path || parsedArgs.AbsolutePath || parsedArgs.file_path || '');
    }
    // Search tools
    if (['grep_search', 'codebase_search', 'search_code', 'todo_search',
         'semantic_code_search', 'structural_search'].includes(name)) {
        return parsedArgs.query || parsedArgs.Query || parsedArgs.pattern || '';
    }
    // Edit / write tools
    if (['edit_file', 'replace_file_content', 'str_replace_editor'].includes(name)) {
        return filename(parsedArgs.path || parsedArgs.TargetFile || '');
    }
    if (['write_file', 'write_to_file'].includes(name)) {
        return filename(parsedArgs.path || parsedArgs.TargetFile || '');
    }
    // Terminal commands
    if (name === 'run_command' || name === 'execute_bash') {
        return parsedArgs.command || parsedArgs.CommandLine || '';
    }
    // Directory listing
    if (['list_dir', 'list_files'].includes(name)) {
        return filename(parsedArgs.path || parsedArgs.DirectoryPath || parsedArgs.directory || '');
    }
    // Structure / bootstrap
    if (name === 'describe_structure' || name === 'bootstrap_context') {
        return filename(parsedArgs.root || parsedArgs.path || parsedArgs.directory || '');
    }
    // Git tools
    if (name === 'git_log' || name === 'git_diff' || name === 'git_blame' || name === 'git_grep') {
        return parsedArgs.file || parsedArgs.path || parsedArgs.query || parsedArgs.pattern || '';
    }
    // Symbol tools
    if (['find_symbol', 'go_to_definition', 'references', 'find_references', 'symbols_list'].includes(name)) {
        return parsedArgs.symbol || parsedArgs.name || parsedArgs.query || '';
    }
    // Web / fetch
    if (name === 'web_search') return parsedArgs.query || '';
    if (name === 'fetch_url') return parsedArgs.url || '';
    if (name === 'github_api') return parsedArgs.endpoint || '';
    // Repo info
    if (name === 'repo_metrics' || name === 'dependency_info') {
        return filename(parsedArgs.root || parsedArgs.path || '');
    }
    // Document tools
    if (name === 'create_document' || name === 'save_document') {
        return parsedArgs.filename || parsedArgs.title || '';
    }
    if (['add_heading', 'add_paragraph'].includes(name)) {
        const text = parsedArgs.text || '';
        return text.length > 40 ? text.slice(0, 40) + '...' : text;
    }
    // Output format
    if (name === 'output_format') return parsedArgs.format || '';
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
    // ── run_command / execute_bash: terminal-style block ──
    if (name === 'run_command' || name === 'execute_bash') {
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

    // ── edit_file / str_replace_editor: inline diff ──
    if (name === 'edit_file' || name === 'replace_file_content' || name === 'str_replace_editor') {
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

    // ── grep_search / search_code / semantic: search results ──
    if (['grep_search', 'codebase_search', 'search_code', 'semantic_code_search', 'structural_search'].includes(name)) {
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
    /**
     * Compact mode — hides the expand chevron and detail entirely.
     * Just shows a single-line tool summary (icon + name + summary).
     * Useful for long conversations where expanding every tool call is noisy.
     */
    compact?: boolean;
    /** Additional className */
    className?: string;
}

export const ToolInvocation: React.FC<ToolInvocationProps> = ({
    name,
    args,
    output,
    meta,
    defaultOpen = false,
    compact = false,
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

    // Compact mode: single-line, no expand capability
    if (compact) {
        return (
            <div className={cn('py-0.5 pl-1 flex items-center gap-2', className)}>
                <ToolInvocationIcon name={name} />
                <span className="text-[10px] text-text-muted">{name}</span>
                {summary && (
                    <span className="text-[10px] font-mono text-text-muted truncate max-w-[200px]">{summary}</span>
                )}
                {output && (
                    <span className="text-[9px] text-status-success-text ml-auto shrink-0">
                        <Check size={10} />
                    </span>
                )}
            </div>
        );
    }

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
