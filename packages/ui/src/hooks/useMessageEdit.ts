'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ChatEvent } from '@kletron/shared/chatTypes';
import type { ReplayImpact } from '../components/CommandCenter/ReplayConfirmDialog';
import { computeReplayImpactPure } from '@kletron/shared/replayImpact';

/* ═══════════════════════════════════════════════════════════════════════════
 * useMessageEdit — shared hook for edit-message + replay
 *
 * Manages the state machine for:
 *  1. Click-to-edit a user message
 *  2. Compute the impact of replaying from that point
 *  3. Show confirmation dialog (via replayDialogOpen / replayImpact)
 *  4. Delegate truncate+resend to the consumer via onTruncateAndResend
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface UseMessageEditOptions {
    /** Current conversation/session ID (null if no active session). */
    sessionId: string | null;
    /** Chat events with messageIndex for impact computation. */
    events: ChatEvent[];
    /** Whether the agent is currently streaming (disables editing). */
    streaming?: boolean;
    /**
     * Called when the user confirms the replay.
     * The consumer should truncate the conversation on the server and resend.
     * @param messageIndex - The index of the edited message
     * @param newContent - The new message content
     */
    onTruncateAndResend: (messageIndex: number, newContent: string) => Promise<void>;
}

export interface UseMessageEditReturn {
    /** Index of the message currently being edited (null if not editing). */
    editingMessageIndex: number | null;
    /** Draft text in the edit textarea. */
    editingMessageDraft: string;
    /** Whether the replay/truncate is in progress. */
    editingMessageSaving: boolean;
    /** Error message from the last failed replay attempt. */
    editingMessageError: string | null;
    /** Update the draft text. */
    setEditingMessageDraft: (value: string) => void;
    /** Enter edit mode for a specific message. */
    startEditMessage: (index: number, content: string) => void;
    /** Exit edit mode without saving. */
    cancelEditMessage: () => void;
    /** Compute impact and trigger either direct replay or show confirmation dialog. */
    handleResendEdit: () => void;
    /** Execute the replay (truncate + resend). Called by consumer or from dialog confirm. */
    executeReplay: () => Promise<void>;
    /** Cancel the replay dialog. */
    cancelReplay: () => void;
    /** Computed replay impact (for the dialog). */
    replayImpact: ReplayImpact | null;
    /** Whether the replay confirmation dialog is open. */
    replayDialogOpen: boolean;
    /** Loading state for the replay dialog. */
    replayLoading: boolean;
}

export function useMessageEdit({
    sessionId,
    events,
    streaming = false,
    onTruncateAndResend,
}: UseMessageEditOptions): UseMessageEditReturn {
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [editingMessageDraft, setEditingMessageDraft] = useState<string>('');
    const [editingMessageSaving, setEditingMessageSaving] = useState(false);
    const [editingMessageError, setEditingMessageError] = useState<string | null>(null);
    const [replayImpact, setReplayImpact] = useState<ReplayImpact | null>(null);
    const [replayDialogOpen, setReplayDialogOpen] = useState(false);
    const [replayLoading, setReplayLoading] = useState(false);

    // Auto-cancel editing when streaming starts or session changes
    useEffect(() => {
        if (streaming && editingMessageIndex !== null) {
            setEditingMessageIndex(null);
            setEditingMessageDraft('');
            setEditingMessageError(null);
        }
    }, [streaming, editingMessageIndex]);

    // Validate that the edited message still exists
    useEffect(() => {
        if (editingMessageIndex === null) return;
        const exists = events.some((e) => e.messageIndex === editingMessageIndex);
        if (!exists) {
            setEditingMessageIndex(null);
            setEditingMessageDraft('');
            setEditingMessageError(null);
        }
    }, [editingMessageIndex, events]);

    const startEditMessage = useCallback((index: number, content: string) => {
        if (streaming) return;
        setEditingMessageIndex(index);
        setEditingMessageDraft(content);
        setEditingMessageError(null);
    }, [streaming]);

    const cancelEditMessage = useCallback(() => {
        setEditingMessageIndex(null);
        setEditingMessageDraft('');
        setEditingMessageError(null);
    }, []);

    const handleResendEdit = useCallback(() => {
        if (editingMessageIndex === null) return;
        const draft = editingMessageDraft.trim();
        if (!draft) return;

        // Find the original content of the message being edited
        const originalEvent = events.find((e) => e.messageIndex === editingMessageIndex);
        const originalContent = originalEvent?.content ?? '';

        // Compute impact
        const impact = computeReplayImpactPure(events, editingMessageIndex, originalContent, draft);

        // If there's nothing after this message, replay directly
        if (impact.messagesRemoved === 0 && impact.toolCallsRemoved === 0 && impact.fileChanges.length === 0) {
            void executeReplayInner(draft);
            return;
        }

        // Show confirmation dialog
        setReplayImpact(impact);
        setReplayDialogOpen(true);
    }, [editingMessageIndex, editingMessageDraft, events]);

    const executeReplayInner = useCallback(async (overrideDraft?: string) => {
        if (editingMessageIndex === null || !sessionId) return;
        const draft = (overrideDraft ?? editingMessageDraft).trim();
        if (!draft) return;

        setReplayLoading(true);
        setReplayDialogOpen(false);
        setEditingMessageSaving(true);
        setEditingMessageError(null);

        try {
            await onTruncateAndResend(editingMessageIndex, draft);
            // Clear editing state on success
            setEditingMessageIndex(null);
            setEditingMessageDraft('');
        } catch (error) {
            setEditingMessageError((error as Error)?.message || 'Unable to replay from this message.');
        } finally {
            setReplayImpact(null);
            setReplayLoading(false);
            setEditingMessageSaving(false);
        }
    }, [editingMessageIndex, editingMessageDraft, sessionId, onTruncateAndResend]);

    const executeReplay = useCallback(async () => {
        await executeReplayInner();
    }, [executeReplayInner]);

    const cancelReplay = useCallback(() => {
        setReplayDialogOpen(false);
        setReplayImpact(null);
    }, []);

    return {
        editingMessageIndex,
        editingMessageDraft,
        editingMessageSaving,
        editingMessageError,
        setEditingMessageDraft,
        startEditMessage,
        cancelEditMessage,
        handleResendEdit,
        executeReplay,
        cancelReplay,
        replayImpact,
        replayDialogOpen,
        replayLoading,
    };
}
