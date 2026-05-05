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
        void navigator.clipboard.writeText(content);
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
 * - User: compact right bubble (Cursor-like); copy/edit in corner on hover, no extra footer gap
 * - Assistant: flat markdown, actions under content on hover
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
    role,
    content,
    timestamp,
    actions,
    className,
    showCopy: _showCopy,
    showTimestamp,
}) => {
    const isUser = role === 'user';

    if (isUser) {
        return (
            <div className={cn('group flex w-full flex-col items-end', className)}>
                <div
                    className={cn(
                        'relative inline-block w-max max-w-[min(85%,28rem)] rounded-xl border border-white/[0.08]',
                        'bg-white/[0.04] px-3 py-2 text-[13px] leading-snug text-text-primary',
                    )}
                >
                    <div className="break-words whitespace-pre-wrap [word-break:break-word] pr-1">{content}</div>
                    {actions ? (
                        <div
                            className={cn(
                                'absolute bottom-1.5 right-1.5 flex items-center gap-px rounded-md',
                                'bg-bg-root/85 p-0.5 shadow-sm ring-1 ring-white/[0.06] backdrop-blur-sm',
                                'opacity-0 transition-opacity duration-100',
                                'pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100',
                                'focus-within:pointer-events-auto focus-within:opacity-100',
                            )}
                        >
                            {actions}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className={cn('group flex flex-col items-start', className)}>
            <div className="relative w-full bg-transparent text-[13px] text-text-primary">
                <div className="break-words text-text-primary">
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
