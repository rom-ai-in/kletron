'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
    /**
     * Live browser stream (NDJSON / `sending`). When this turns on mid-edit, edit UI is cleared.
     * Do **not** pass generic “run busy” here — server-side RUNNING without a stream would fight
     * replay confirm (epoch / index cleared while the modal is open).
     */
    streaming?: boolean;
    /** When true, disallow entering edit mode (e.g. agent busy without treating it as `streaming`). */
    blockEdit?: boolean;
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
    blockEdit = false,
    onTruncateAndResend,
}: UseMessageEditOptions): UseMessageEditReturn {
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [editingMessageDraft, setEditingMessageDraft] = useState<string>('');
    const [editingMessageSaving, setEditingMessageSaving] = useState(false);
    const [editingMessageError, setEditingMessageError] = useState<string | null>(null);
    const [replayImpact, setReplayImpact] = useState<ReplayImpact | null>(null);
    const [replayDialogOpen, setReplayDialogOpen] = useState(false);
    const [replayLoading, setReplayLoading] = useState(false);
    /** Bumped when the user leaves edit mode so in-flight truncate/replay cannot leave saving flags stuck. */
    const replayEpochRef = useRef(0);
    /** Captured when opening the replay confirm dialog so Confirm still works if React state is cleared mid-flight. */
    const replayConfirmSnapshotRef = useRef<{ messageIndex: number; draft: string } | null>(null);

    // Auto-cancel editing when streaming starts or session changes
    useEffect(() => {
        if (streaming && editingMessageIndex !== null) {
            replayEpochRef.current += 1;
            setEditingMessageIndex(null);
            setEditingMessageDraft('');
            setEditingMessageError(null);
            setEditingMessageSaving(false);
            setReplayLoading(false);
            setReplayDialogOpen(false);
            setReplayImpact(null);
            replayConfirmSnapshotRef.current = null;
        }
    }, [streaming, editingMessageIndex]);

    // Validate that the edited message still exists
    useEffect(() => {
        if (editingMessageIndex === null) return;
        const exists = events.some((e) => e.messageIndex === editingMessageIndex);
        if (!exists) {
            replayEpochRef.current += 1;
            setEditingMessageIndex(null);
            setEditingMessageDraft('');
            setEditingMessageError(null);
            setEditingMessageSaving(false);
            setReplayLoading(false);
            setReplayDialogOpen(false);
            setReplayImpact(null);
            replayConfirmSnapshotRef.current = null;
        }
    }, [editingMessageIndex, events]);

    const startEditMessage = useCallback((index: number, content: string) => {
        if (streaming || blockEdit) return;
        replayEpochRef.current += 1;
        setEditingMessageIndex(index);
        setEditingMessageDraft(content);
        setEditingMessageError(null);
        setEditingMessageSaving(false);
        setReplayLoading(false);
        setReplayDialogOpen(false);
        setReplayImpact(null);
        replayConfirmSnapshotRef.current = null;
    }, [streaming, blockEdit]);

    const cancelEditMessage = useCallback(() => {
        replayEpochRef.current += 1;
        setEditingMessageIndex(null);
        setEditingMessageDraft('');
        setEditingMessageError(null);
        setEditingMessageSaving(false);
        setReplayLoading(false);
        setReplayDialogOpen(false);
        setReplayImpact(null);
        replayConfirmSnapshotRef.current = null;
    }, []);

    const executeReplayInner = useCallback(async (overrideDraft?: string) => {
        const snap = replayConfirmSnapshotRef.current;
        const resolvedIndex = editingMessageIndex ?? snap?.messageIndex ?? null;
        const draft = String(overrideDraft ?? editingMessageDraft ?? snap?.draft ?? '').trim();

        if (resolvedIndex === null) {
            setEditingMessageError('Could not resend — edit session expired. Close the dialog and try again.');
            setReplayDialogOpen(false);
            setReplayImpact(null);
            replayConfirmSnapshotRef.current = null;
            return;
        }
        if (!sessionId) {
            setEditingMessageError('No active session — open a thread before resending.');
            return;
        }
        if (!draft) {
            setEditingMessageError('Message cannot be empty.');
            return;
        }

        const epoch = replayEpochRef.current;

        setReplayLoading(true);
        setReplayDialogOpen(false);
        setEditingMessageSaving(true);
        setEditingMessageError(null);

        try {
            await onTruncateAndResend(resolvedIndex, draft);
            if (epoch !== replayEpochRef.current) return;
            replayConfirmSnapshotRef.current = null;
            setEditingMessageIndex(null);
            setEditingMessageDraft('');
        } catch (error) {
            if (epoch !== replayEpochRef.current) return;
            setEditingMessageError((error as Error)?.message || 'Unable to replay from this message.');
        } finally {
            if (epoch === replayEpochRef.current) {
                setReplayImpact(null);
                setReplayLoading(false);
                setEditingMessageSaving(false);
            }
        }
    }, [editingMessageIndex, editingMessageDraft, sessionId, onTruncateAndResend]);

    const handleResendEdit = useCallback(() => {
        if (editingMessageIndex === null) return;
        const draft = editingMessageDraft.trim();
        if (!draft) {
            setEditingMessageError('Message cannot be empty.');
            return;
        }

        const originalEvent = events.find((e) => e.messageIndex === editingMessageIndex);
        const originalContent = originalEvent?.content ?? '';

        const impact = computeReplayImpactPure(events, editingMessageIndex, originalContent, draft);

        if (impact.messagesRemoved === 0 && impact.toolCallsRemoved === 0 && impact.fileChanges.length === 0) {
            replayConfirmSnapshotRef.current = null;
            void executeReplayInner(draft);
            return;
        }

        replayConfirmSnapshotRef.current = {
            messageIndex: editingMessageIndex,
            draft,
        };
        setReplayImpact(impact);
        setReplayDialogOpen(true);
    }, [editingMessageIndex, editingMessageDraft, events, executeReplayInner]);

    const executeReplay = useCallback(async () => {
        await executeReplayInner();
    }, [executeReplayInner]);

    const cancelReplay = useCallback(() => {
        setReplayDialogOpen(false);
        setReplayImpact(null);
        setReplayLoading(false);
        replayConfirmSnapshotRef.current = null;
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
