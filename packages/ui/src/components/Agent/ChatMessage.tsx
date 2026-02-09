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
 * - User messages: right-aligned, bordered, plain text
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

    return (
        <div className={cn(`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`, className)}>
            <div
                className={cn(
                    'relative rounded-lg px-3 py-2 text-[12px]',
                    isUser
                        ? 'border border-border-strong bg-bg-elevated text-text-primary max-w-[90%] shadow-sm'
                        : 'bg-transparent text-text-secondary w-full',
                )}
            >
                {/* Content */}
                <div className={cn('break-words', isUser ? 'text-text-primary' : 'text-text-secondary')}>
                    {isUser ? content : <MarkdownRenderer content={content} />}
                </div>

                {/* Actions slot */}
                {actions}

                {/* Timestamp + Copy (hover reveal, assistant only by default) */}
                {!isUser && (showCopy !== false || showTimestamp !== false) && (
                    <div className="mt-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-start">
                        {showTimestamp !== false && timestamp && (
                            <span className="text-[9px] text-text-muted font-mono">{timestamp}</span>
                        )}
                        {showCopy !== false && content && <CopyButton content={content} />}
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
