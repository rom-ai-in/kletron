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
    Plug,
    Search,
    Terminal as TerminalIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { normalizeToolName } from '../../lib/toolCategories';

/** `hunter__Domain-Search` → { provider: 'hunter', tool: 'Domain-Search' } */
export function splitMcpToolName(full: string): { provider: string | null; tool: string } {
    const s = String(full ?? '').trim();
    const idx = s.indexOf('__');
    if (idx <= 0) return { provider: null, tool: s };
    return { provider: s.slice(0, idx), tool: s.slice(idx + 2) };
}

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
    const base = normalizeToolName(name) || name.toLowerCase();
    const raw = String(name ?? '');
    const hasMcpPrefix = raw.includes('__');
    // Terminal / execution
    if (base === 'run_command' || base === 'execute_bash') return <TerminalIcon className={cls} />;
    // Search tools
    if (['grep_search', 'codebase_search', 'search_code', 'todo_search', 'semantic_code_search',
         'find_symbol', 'go_to_definition', 'references',
         'structural_search', 'locate_ui_feature'].includes(base))
        return <Search className={cls} />;
    if (base.includes('search') || base.includes('grep')) return <Search className={cls} />;
    // Edit / write tools
    if (['edit_file', 'replace_file_content', 'write_file', 'write_to_file', 'str_replace_editor',
         'write_todos'].includes(base))
        return <Pencil className={cls} />;
    // Read / view tools
    if (['read_file', 'view_file', 'read_file_range'].includes(base))
        return <FileText className={cls} />;
    // Directory / structure tools
    if (['list_dir', 'list_files', 'describe_structure', 'symbols_list',
         'bootstrap_context'].includes(base))
        return <FolderOpen className={cls} />;
    // Git tools
    if (['git_log', 'git_diff', 'git_blame', 'git_grep'].includes(base))
        return <GitBranch className={cls} />;
    // Web / fetch tools
    if (['web_search', 'fetch_url', 'github_api'].includes(base))
        return <Globe className={cls} />;
    // Metrics / dependency info
    if (['repo_metrics', 'dependency_info'].includes(base))
        return <Package className={cls} />;
    // Output format
    if (base === 'output_format') return <LayoutList className={cls} />;
    if (hasMcpPrefix) return <Plug className={cn(cls, 'text-text-muted/90')} />;
    return <Circle className={cls} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * getToolSummary — friendly summary from tool name + args
 * ═══════════════════════════════════════════════════════════════════════════ */

function getToolSummary(name: string, parsedArgs: Record<string, any>): string {
    const base = normalizeToolName(name) || name;
    // Helper: extract filename from path
    const filename = (p: string) => (p ? p.split('/').pop() || p : '');

    // File read/view
    if (['read_file', 'view_file', 'read_file_range'].includes(base)) {
        return filename(parsedArgs.path || parsedArgs.AbsolutePath || parsedArgs.file_path || '');
    }
    // Search tools
    if (['grep_search', 'codebase_search', 'search_code', 'todo_search',
         'semantic_code_search', 'structural_search'].includes(base)) {
        return parsedArgs.query || parsedArgs.Query || parsedArgs.pattern || '';
    }
    // Edit / write tools
    if (['edit_file', 'replace_file_content', 'str_replace_editor'].includes(base)) {
        return filename(parsedArgs.path || parsedArgs.filePath || parsedArgs.TargetFile || '');
    }
    if (['write_file', 'write_to_file'].includes(base)) {
        return filename(parsedArgs.path || parsedArgs.TargetFile || '');
    }
    // Terminal commands
    if (base === 'run_command' || base === 'execute_bash') {
        return parsedArgs.command || parsedArgs.CommandLine || '';
    }
    // Directory listing
    if (['list_dir', 'list_files'].includes(base)) {
        return filename(parsedArgs.path || parsedArgs.DirectoryPath || parsedArgs.directory || '');
    }
    // Structure / bootstrap
    if (base === 'describe_structure' || base === 'bootstrap_context') {
        return filename(parsedArgs.root || parsedArgs.path || parsedArgs.directory || '');
    }
    // Git tools
    if (base === 'git_log' || base === 'git_diff' || base === 'git_blame' || base === 'git_grep') {
        return parsedArgs.file || parsedArgs.path || parsedArgs.query || parsedArgs.pattern || '';
    }
    // Symbol tools
    if (['find_symbol', 'go_to_definition', 'references', 'symbols_list'].includes(base)) {
        return parsedArgs.symbol || parsedArgs.name || parsedArgs.query || '';
    }
    // Web / fetch
    if (base === 'web_search') return parsedArgs.query || '';
    if (base === 'fetch_url') return parsedArgs.url || '';
    if (base === 'github_api') return parsedArgs.endpoint || '';
    // Repo info
    if (base === 'repo_metrics' || base === 'dependency_info') {
        return filename(parsedArgs.root || parsedArgs.path || '');
    }

    // Output format
    if (base === 'output_format') return parsedArgs.format || '';
    // MCP / generic: pick a short hint from common arg keys
    const hint =
        parsedArgs.query ||
        parsedArgs.name ||
        parsedArgs.uid ||
        parsedArgs.domain ||
        parsedArgs.email ||
        parsedArgs.url ||
        '';
    return typeof hint === 'string' ? hint : '';
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
        const filePath = parsedArgs.path || parsedArgs.filePath || parsedArgs.TargetFile || '';
        const oldStr: string = parsedArgs.old_str || parsedArgs.old_string || '';
        const newStr: string = parsedArgs.new_str || parsedArgs.new_string || '';

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
    const baseName = normalizeToolName(name) || name;
    if (['grep_search', 'codebase_search', 'search_code', 'semantic_code_search', 'structural_search'].includes(baseName)) {
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
    const { provider, tool } = splitMcpToolName(name);

    // Compact mode: Cursor-like chip, no expand
    if (compact) {
        return (
            <div
                className={cn(
                    'inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/[0.08]',
                    'bg-[var(--bg-elevated)]/90 px-2 py-1 shadow-[inset_0_1px_0_0_var(--border-subtle)]',
                    className,
                )}
            >
                <ToolInvocationIcon name={name} className="shrink-0 text-text-muted" />
                {provider ? (
                    <span className="shrink-0 rounded px-1 py-px text-[9px] font-medium uppercase tracking-wide text-text-muted ring-1 ring-white/[0.06]">
                        {provider}
                    </span>
                ) : null}
                <span className="min-w-0 truncate font-mono text-[10px] text-text-primary">{tool}</span>
                {summary ? (
                    <span className="min-w-0 truncate font-mono text-[9px] text-text-muted/85 max-w-[min(12rem,42vw)]">
                        {summary}
                    </span>
                ) : null}
                {output ? (
                    <span className="ml-auto shrink-0 text-status-success-text">
                        <Check size={11} strokeWidth={2.5} aria-hidden />
                    </span>
                ) : null}
            </div>
        );
    }

    return (
        <div className={cn('py-0.5', className)}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className={cn(
                    'flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-left',
                    'transition-colors duration-150 hover:border-white/[0.1] hover:bg-white/[0.04]',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]',
                )}
            >
                <div className={cn('shrink-0 text-text-muted transition-transform duration-200', open && 'rotate-90')}>
                    <ChevronRight size={12} strokeWidth={2} />
                </div>
                <ToolInvocationIcon name={name} />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    {provider ? (
                        <span className="shrink-0 rounded px-1 py-px text-[9px] font-medium uppercase tracking-wide text-text-muted ring-1 ring-white/[0.06]">
                            {provider}
                        </span>
                    ) : null}
                    <span className="font-mono text-[11px] font-medium text-text-secondary">{tool}</span>
                    {summary ? (
                        <span className="min-w-0 truncate font-mono text-[10px] text-text-muted max-w-[min(14rem,50vw)]">
                            {summary}
                        </span>
                    ) : null}
                </div>
                {meta ? (
                    <span className="shrink-0 font-mono text-[10px] text-text-muted tabular-nums">{meta}</span>
                ) : null}
            </button>

            {open && (
                <div className="mt-1.5 rounded-md border border-white/[0.06] bg-[var(--bg-elevated)]/40 p-2 pl-3">
                    <div className="border-l border-[var(--border-strong)] pl-2.5">
                        <ToolInvocationDetail name={name} args={args} output={output} parsedArgs={parsedArgs} />
                    </div>
                </div>
            )}
        </div>
    );
};
