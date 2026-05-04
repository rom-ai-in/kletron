'use client';

import React, { useState, useCallback } from 'react';
import { Copy, Check, Pencil } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ChatEvent } from '@kletron/shared/chatTypes';

/* ═══════════════════════════════════════════════════════════════════════════
 * MessageActions — per-message hover action buttons (copy, edit)
 *
 * Designed to be passed as the `messageActions` slot on <MessageList>.
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface MessageActionsProps {
    /** The chat event this action bar belongs to. */
    event: ChatEvent;
    /** Called when the user clicks "Edit" on a user message. */
    onStartEdit?: (messageIndex: number, content: string) => void;
    /** Whether the agent is currently streaming (disables edit). */
    streaming?: boolean;
    /** Additional className. */
    className?: string;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
    event,
    onStartEdit,
    streaming = false,
    className,
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        if (!event.content) return;
        navigator.clipboard.writeText(event.content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => { /* ignore */ });
    }, [event.content]);

    const isUser = event.kind === 'user';
    const canEdit = isUser && !streaming && typeof event.messageIndex === 'number' && event.messageIndex !== null;
    const hasContent = !!event.content;

    if (!hasContent && !canEdit) return null;

    return (
        <div
            className={cn(
                'flex items-center gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
                isUser ? 'justify-end' : 'justify-start',
                className,
            )}
        >
            {/* Copy button */}
            {hasContent && (
                <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                    title={copied ? 'Copied!' : 'Copy message'}
                >
                    {copied ? (
                        <Check className="w-3 h-3 text-status-success-text" />
                    ) : (
                        <Copy className="w-3 h-3" />
                    )}
                </button>
            )}

            {/* Edit button (user messages only, not during streaming) */}
            {canEdit && onStartEdit && (
                <button
                    type="button"
                    onClick={() => onStartEdit(event.messageIndex!, event.content || '')}
                    className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                    title="Edit and resend"
                >
                    <Pencil className="w-3 h-3" />
                </button>
            )}
        </div>
    );
};
