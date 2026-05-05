'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize from 'rehype-sanitize';
import { CodeBlock } from './CodeBlock';

function normalizeCellText(raw: string): string {
    return raw.replace(/\r?\n/g, ' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Tab-separated rows for Excel / Sheets */
function tableToTsv(table: HTMLTableElement): string {
    const rows = Array.from(table.rows);
    return rows
        .map((row) =>
            Array.from(row.cells)
                .map((c) => normalizeCellText(c.textContent ?? ''))
                .join('\t'),
        )
        .join('\n');
}

function MarkdownTableFrame({
    tableClassName,
    children,
}: {
    tableClassName: string;
    children: React.ReactNode;
}) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const table = rootRef.current?.querySelector('table');
        if (!table) return;
        const tsv = tableToTsv(table);
        try {
            await navigator.clipboard.writeText(tsv);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            /* ignore */
        }
    };

    return (
        <div className="my-2.5 first:mt-0 last:mb-0 overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[inset_0_1px_0_0_var(--border-subtle)]">
            <div className="relative group flex items-center justify-between gap-2 border-b border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1">
                <span className="text-[10px] font-mono lowercase text-text-muted">table</span>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded p-1 text-text-muted opacity-0 transition-opacity duration-150 hover:bg-[var(--state-hover)] hover:text-text-primary group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    title="Copy table (TSV — paste in Excel, Sheets, etc.)"
                >
                    {copied ? <Check size={12} className="text-status-success-text" /> : <Copy size={12} />}
                </button>
            </div>
            <div ref={rootRef} className="overflow-x-auto">
                <table className={tableClassName}>{children}</table>
            </div>
        </div>
    );
}

export type MarkdownRendererVariant = 'default' | 'chat';

export interface MarkdownRendererProps {
    content: string;
    className?: string;
    /** `chat` uses tighter vertical rhythm for streaming / transcript bubbles */
    variant?: MarkdownRendererVariant;
}

/**
 * Shared markdown renderer with design-system styling.
 * Wraps react-markdown + remark-gfm with consistent overrides for
 * headings, lists, links, blockquotes, and code blocks.
 *
 * NOTE: For "Cursor-Parity" UI Minimalism, we do NOT use regex replacements
 * to strip headers and separators (regex destroys markdown inside code blocks).
 * `default` flattens headings to <p> for compact layouts; `chat` uses
 * distinct heading styles so assistant replies read with clear structure.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className, variant = 'default' }) => {
    const components = useMemo(() => {
        const isChat = variant === 'chat';
        const pBody = isChat
            ? 'mb-1.5 last:mb-0 leading-[1.45] min-h-[1em] text-text-primary'
            : 'mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary';
        const pFlat = isChat
            ? 'mb-0 last:mb-0 leading-[1.35] min-h-[1em] text-text-primary'
            : 'mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary';
        const listMb = isChat ? 'mb-1.5 last:mb-0' : 'mb-0.5';
        const liGap = isChat ? 'space-y-1' : 'space-y-0';

        /* Cursor / IDE-style data tables (+ MarkdownTableFrame toolbar for copy) */
        const tableEl =
            'w-full min-w-[16rem] border-collapse text-left text-[12px] leading-snug tabular-nums';
        const thCell =
            'border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-2 font-semibold text-[var(--text-secondary)] [&_p]:m-0 [&_p]:leading-snug';
        const tdCell =
            'border border-[var(--border-subtle)] px-2.5 py-1.5 align-top text-[var(--text-primary)] [&_p]:m-0 [&_p]:leading-snug [&_strong]:font-semibold';

        return {
            pre: ({ children }: any) => <>{children}</>,
            p: ({ children }: any) => <p className={pBody}>{children}</p>,
            ul: ({ children }: any) => (
                <ul className={`list-disc pl-3.5 ${listMb} ${liGap} marker:text-text-muted`}>{children}</ul>
            ),
            ol: ({ children }: any) => (
                <ol className={`list-decimal pl-3.5 ${listMb} ${liGap} marker:text-text-muted`}>{children}</ol>
            ),
            li: ({ children }: any) => (
                <li
                    className={
                        isChat
                            ? 'pl-0.5 whitespace-normal leading-[1.4] text-text-primary'
                            : 'pl-0.5 whitespace-normal leading-[1.4]'
                    }
                >
                    {children}
                </li>
            ),
            /* Chat: real heading hierarchy so replies don’t look like one flat block */
            h1: ({ children }: any) =>
                isChat ? (
                    <p className="mb-1.5 mt-1 first:mt-0 text-[13px] font-semibold leading-snug text-text-primary">{children}</p>
                ) : (
                    <p className={pFlat}>{children}</p>
                ),
            h2: ({ children }: any) =>
                isChat ? (
                    <p className="mb-1.5 mt-1 first:mt-0 text-[12px] font-semibold leading-snug text-text-primary">{children}</p>
                ) : (
                    <p className={pFlat}>{children}</p>
                ),
            h3: ({ children }: any) =>
                isChat ? (
                    <p className="mb-1 first:mt-0 text-[12px] font-medium leading-snug text-text-primary/95">{children}</p>
                ) : (
                    <p className={pFlat}>{children}</p>
                ),
            h4: ({ children }: any) =>
                isChat ? (
                    <p className="mb-1 text-[12px] font-medium leading-snug text-text-primary/90">{children}</p>
                ) : (
                    <p className={pFlat}>{children}</p>
                ),
            h5: ({ children }: any) => <p className={pFlat}>{children}</p>,
            h6: ({ children }: any) => <p className={pFlat}>{children}</p>,
            strong: ({ children }: any) => <span className="text-text-primary">{children}</span>,
            b: ({ children }: any) => <span className="text-text-primary">{children}</span>,
            hr: () => null,
            a: ({ href, children }: any) => (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-primary underline decoration-border-strong/60 hover:decoration-border-strong"
                >
                    {children}
                </a>
            ),
            blockquote: ({ children }: any) => (
                <blockquote className="border-l-2 border-border-subtle pl-2 italic text-text-muted my-0.5">
                    {children}
                </blockquote>
            ),
            table: ({ children }: any) => <MarkdownTableFrame tableClassName={tableEl}>{children}</MarkdownTableFrame>,
            thead: ({ children }: any) => <thead>{children}</thead>,
            tbody: ({ children }: any) => (
                <tbody className="[&>tr:nth-child(even)]:bg-[var(--state-hover)]">{children}</tbody>
            ),
            tr: ({ children }: any) => <tr>{children}</tr>,
            th: ({ children }: any) => <th className={thCell}>{children}</th>,
            td: ({ children }: any) => <td className={tdCell}>{children}</td>,
            code: ({ node: _node, inline, className: codeClass, children, ...props }: any) => (
                <CodeBlock inline={inline} className={codeClass} {...props}>
                    {children}
                </CodeBlock>
            ),
        };
    }, [variant]);

    if (!content) return null;

    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeSanitize]}
                components={components as any}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};
