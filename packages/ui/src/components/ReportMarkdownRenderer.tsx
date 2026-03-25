"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Report-grade markdown renderer with proper heading hierarchy.
 * Unlike the chat MarkdownRenderer (which flattens headings for Cursor-style),
 * this preserves h1–h6 for structured automation reports.
 */
export function ReportMarkdownRenderer({ content, className = "" }: { content: string; className?: string }) {
    if (!content) return null;

    return (
        <div className={`prose-report ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }: any) => (
                        <h1 className="mb-3 mt-6 first:mt-0 text-lg font-bold text-text-primary border-b border-border-subtle pb-2">{children}</h1>
                    ),
                    h2: ({ children }: any) => (
                        <h2 className="mb-2 mt-5 text-sm font-bold text-text-primary">{children}</h2>
                    ),
                    h3: ({ children }: any) => (
                        <h3 className="mb-1.5 mt-4 text-sm font-semibold text-text-secondary">{children}</h3>
                    ),
                    h4: ({ children }: any) => (
                        <h4 className="mb-1 mt-3 text-xs font-semibold text-text-secondary">{children}</h4>
                    ),
                    h5: ({ children }: any) => (
                        <h5 className="mb-1 mt-2 text-xs font-medium text-text-muted">{children}</h5>
                    ),
                    h6: ({ children }: any) => (
                        <h6 className="mb-1 mt-2 text-xs font-medium text-text-muted">{children}</h6>
                    ),
                    p: ({ children }: any) => (
                        <p className="mb-2 text-xs leading-relaxed text-text-secondary">{children}</p>
                    ),
                    ul: ({ children }: any) => (
                        <ul className="mb-2 list-disc pl-4 space-y-0.5 marker:text-text-muted">{children}</ul>
                    ),
                    ol: ({ children }: any) => (
                        <ol className="mb-2 list-decimal pl-4 space-y-0.5 marker:text-text-muted">{children}</ol>
                    ),
                    li: ({ children }: any) => (
                        <li className="text-xs text-text-secondary leading-relaxed">{children}</li>
                    ),
                    strong: ({ children }: any) => <strong className="font-semibold text-text-primary">{children}</strong>,
                    em: ({ children }: any) => <em className="text-text-muted">{children}</em>,
                    a: ({ href, children }: any) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-text-primary underline decoration-border-strong/60 hover:decoration-border-strong">
                            {children}
                        </a>
                    ),
                    blockquote: ({ children }: any) => (
                        <blockquote className="my-2 border-l-2 border-border-strong pl-3 text-xs italic text-text-muted">{children}</blockquote>
                    ),
                    hr: () => <hr className="my-4 border-border-subtle" />,
                    code: ({ inline, className, children, ...props }: any) => {
                        if (inline) {
                            return <code className="rounded bg-bg-elevated px-1 py-0.5 text-[10px] font-mono text-text-primary" {...props}>{children}</code>;
                        }
                        return (
                            <pre className="my-2 overflow-x-auto rounded-md border border-border-subtle bg-bg-elevated p-3 text-[10px] font-mono text-text-secondary">
                                <code {...props}>{children}</code>
                            </pre>
                        );
                    },
                    pre: ({ children }: any) => <>{children}</>,
                    table: ({ children }: any) => (
                        <div className="my-2 overflow-x-auto rounded-md border border-border-subtle">
                            <table className="w-full text-xs">{children}</table>
                        </div>
                    ),
                    thead: ({ children }: any) => <thead className="bg-bg-elevated">{children}</thead>,
                    th: ({ children }: any) => (
                        <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border-subtle">{children}</th>
                    ),
                    td: ({ children }: any) => (
                        <td className="px-3 py-1.5 text-xs text-text-secondary border-b border-border-subtle">{children}</td>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
