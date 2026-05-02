'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';

/* ═══════════════════════════════════════════════════════════════════════════
 * CopyButton — reusable copy-to-clipboard button
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface CopyButtonProps {
    content: string;
    className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ content, className }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className={cn("p-1 text-text-muted hover:text-text-primary transition-colors", className)}
            title="Copy message"
        >
            {copied ? <Check size={10} className="text-status-success-text" /> : <Copy size={10} />}
        </button>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * MessageBubble — renders user or assistant chat messages
 * ═══════════════════════════════════════════════════════════════════════════ */

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageBubbleProps {
    role: MessageRole;
    content: string;
    timestamp?: string;
    /** Slot for action buttons (edit, copy, etc.) shown on hover */
    actions?: React.ReactNode;
    /** Additional className for the outer wrapper */
    className?: string;
    /** Whether to show the copy button on hover (default: true for assistant) */
    showCopy?: boolean;
    /** Whether to show timestamp on hover (default: true for assistant) */
    showTimestamp?: boolean;
}

/**
 * Shared message bubble component.
 * - User messages: right-aligned, Cursor-style surface; actions sit in a reserved row below (hover)
 * - Assistant messages: left-aligned, transparent bg, markdown-rendered
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
    role,
    content,
    timestamp,
    actions,
    className,
    showCopy,
    showTimestamp,
}) => {
    const isUser = role === 'user';

    if (isUser) {
        return (
            <div className={cn('group flex w-full flex-col items-end', className)}>
                <div
                    className={cn(
                        'relative w-full max-w-[min(90%,36rem)] rounded-2xl border border-white/[0.09]',
                        'bg-white/[0.05] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]',
                        'px-3.5 py-2.5 text-[13px] leading-[1.5] text-text-primary',
                        'transition-[border-color,box-shadow] duration-200',
                        'group-hover:border-white/[0.14] group-hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.04)]',
                    )}
                >
                    <div className="break-words whitespace-pre-wrap [word-break:break-word]">{content}</div>
                </div>
                {/* Reserved height: copy/edit stay below the bubble and clear the next message */}
                {actions ? (
                    <div
                        className={cn(
                            'mt-1.5 flex min-h-[28px] w-full max-w-[min(90%,36rem)] flex-row items-center justify-end gap-0.5 px-0.5',
                            'pointer-events-none opacity-0 transition-opacity duration-150',
                            'group-hover:pointer-events-auto group-hover:opacity-100',
                            'focus-within:pointer-events-auto focus-within:opacity-100',
                        )}
                    >
                        {actions}
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className={cn('group flex flex-col items-start', className)}>
            <div className="relative w-full bg-transparent text-[12px] text-text-secondary">
                <div className="break-words text-text-secondary">
                    <MarkdownRenderer content={content} variant="chat" />
                </div>

                {actions ? (
                    <div className="mt-0.5 flex justify-start opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        {actions}
                    </div>
                ) : null}

                {showTimestamp !== false && timestamp && (
                    <div className="mt-0.5 flex items-center justify-start opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="font-mono text-[9px] text-text-muted">{timestamp}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * SystemMessage — small muted text line for system/status events
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface SystemMessageProps {
    content: string;
    className?: string;
}

export const SystemMessage: React.FC<SystemMessageProps> = ({ content, className }) => {
    return (
        <div className={cn('px-1 py-1 text-[10px] text-text-muted', className)}>
            {content}
        </div>
    );
};
