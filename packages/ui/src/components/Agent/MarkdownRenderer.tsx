'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize from 'rehype-sanitize';
import { CodeBlock } from './CodeBlock';

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
            ? 'mb-1.5 last:mb-0 leading-[1.45] min-h-[1em] text-text-secondary'
            : 'mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary';
        const pFlat = isChat
            ? 'mb-0 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary'
            : 'mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary';
        const listMb = isChat ? 'mb-1.5 last:mb-0' : 'mb-0.5';
        const liGap = isChat ? 'space-y-1' : 'space-y-0';

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
                <li className="pl-0.5 whitespace-normal leading-[1.4]">{children}</li>
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
                    <p className="mb-1 text-[12px] font-medium leading-snug text-text-secondary">{children}</p>
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
            code: ({ node, inline, className: codeClass, children, ...props }: any) => (
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
