'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize from 'rehype-sanitize';
import { CodeBlock } from './CodeBlock';

export interface MarkdownRendererProps {
    content: string;
    className?: string;
}

/**
 * Shared markdown renderer with design-system styling.
 * Wraps react-markdown + remark-gfm with consistent overrides for
 * headings, lists, links, blockquotes, and code blocks.
 * 
 * NOTE: For "Cursor-Parity" UI Minimalism, we do NOT use regex replacements
 * to strip headers and separators (regex destroys markdown inside code blocks).
 * Instead, we use "AST Flattening": ReactMarkdown parses the document safely,
 * and we override the h1-h6 tags below to render as plain <p> tags,
 * leaving raw code blocks entirely untouched!
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
    if (!content) return null;

    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                    pre: ({ children }: any) => <>{children}</>,
                    p: ({ children }: any) => (
                        <p className="mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary">{children}</p>
                    ),
                    ul: ({ children }: any) => (
                        <ul className="list-disc pl-3.5 mb-0.5 space-y-0 marker:text-text-muted">{children}</ul>
                    ),
                    ol: ({ children }: any) => (
                        <ol className="list-decimal pl-3.5 mb-0.5 space-y-0 marker:text-text-muted">{children}</ol>
                    ),
                    li: ({ children }: any) => (
                        <li className="pl-0.5 whitespace-normal leading-[1.35]">{children}</li>
                    ),
                    h1: ({ children }: any) => (
                        <p className="mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary">{children}</p>
                    ),
                    h2: ({ children }: any) => (
                        <p className="mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary">{children}</p>
                    ),
                    h3: ({ children }: any) => (
                        <p className="mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary">{children}</p>
                    ),
                    h4: ({ children }: any) => (
                        <p className="mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary">{children}</p>
                    ),
                    h5: ({ children }: any) => (
                        <p className="mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary">{children}</p>
                    ),
                    h6: ({ children }: any) => (
                        <p className="mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary">{children}</p>
                    ),
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
                    code: ({ node, inline, className, children, ...props }: any) => (
                        <CodeBlock inline={inline} className={className} {...props}>
                            {children}
                        </CodeBlock>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};
