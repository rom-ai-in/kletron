import { useState, useRef, useCallback, useEffect } from 'react';
import type { AgentEvent, AgentWorkflowResult, AgentWorkflowUpdate, TimelineEvent } from '@numezis/shared/types';
import type { Message, StreamStatus, StreamChunk } from '@numezis/shared/chatTypes';
import { extractThoughtsFromContent, sanitizeVisibleAssistantContent, normalizeMessage } from '@numezis/shared/contentSanitizer';

// Re-export for backward compatibility
export type { Message, StreamStatus };
export { normalizeMessage };

// ─── Utility Functions (imported from @numezis/shared/contentSanitizer) ─────
// extractThoughtsFromContent, sanitizeVisibleAssistantContent, normalizeMessage
// are now imported above from the shared module.

// ─── Types ──────────────────────────────────────────────────────────────────
// StreamChunk is now imported from @numezis/shared/chatTypes above.


export type TokenUsageForDisplay = {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    callCount?: number;
    model?: string;
};

export interface UseSessionStreamOptions {
    /** Currently active session/run ID (null if no session yet). */
    sessionId: string | null;
    /** Currently selected graph ID. */
    selectedGraphId: string;
    /** Currently selected LLM provider. */
    llmProvider: string;
    /** LLM model override (optional). */
    llmModel?: string;
    /** Active workspace ID to scope new sessions to. */
    workspaceId?: string | null;
    /** Callback when a new session is created (receives runId). */
    onSessionCreated?: (runId: string, graphId: string) => void;
    /** Callback when a title should be generated. */
    onTitleGenerate?: (runId: string, userMessage: string) => void;
}

export interface UseSessionStreamReturn {
    /** Messages for simple chat view (converted from eventStream). */
    messages: Message[];
    /**
     * Safe setter for messages.  During active streaming this is a no-op to
     * prevent race conditions (e.g. loadSessionDetail overwriting stream data).
     * After the stream finishes, calls go through normally.
     */
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    /** Full event stream (for timeline/event card view). */
    eventStream: AgentEvent[];
    /** Timeline events for multi-node graphs. */
    timeline: TimelineEvent[];
    /** Input field value. */
    input: string;
    setInput: (value: string) => void;
    /** Whether we're currently streaming. */
    sending: boolean;
    /** Stream status. */
    streamStatus: StreamStatus;
    /** Human-readable error message (set when streamStatus is "error"). */
    errorMessage: string | null;
    /** Token usage from the current run. */
    tokenUsage: TokenUsageForDisplay | null;
    /** When the run started. */
    runStartedAt: string | null;
    /** When the run ended. */
    runEndedAt: string | null;
    /** Progressive streaming text — accumulates token-by-token content from the LLM. */
    streamingText: string;
    /** Send a message (creates a new session or continues existing one).
     *  Optionally accepts a `text` override to bypass the input state. */
    handleSend: (options?: { text?: string }) => Promise<void>;
    /** Stop the current stream. */
    handleStop: () => void;
    /** Keyboard handler (Enter to send). */
    handleKeyDown: (e: React.KeyboardEvent) => void;
    /** Format ISO time for display. */
    formatTime: (iso: string) => string;
    /** Whether scrolled to bottom. */
    isAtBottomRef: React.MutableRefObject<boolean>;
    /** The final result of the last run. */
    lastResult: AgentWorkflowResult | null;
    /** Whether we are inside an active stream request. */
    isStreaming: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useSessionStream(options: UseSessionStreamOptions): UseSessionStreamReturn {
    const {
        sessionId,
        selectedGraphId,
        llmProvider,
        llmModel,
        workspaceId,
        onSessionCreated,
        onTitleGenerate,
    } = options;

    const [messages, setMessages] = useState<Message[]>([]);
    const [eventStream, setEventStream] = useState<AgentEvent[]>([]);
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
    const [tokenUsage, setTokenUsage] = useState<TokenUsageForDisplay | null>(null);
    const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
    const [runEndedAt, setRunEndedAt] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<AgentWorkflowResult | null>(null);
    const [streamingText, setStreamingText] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const isAtBottomRef = useRef(true);
    const isFirstMessageRef = useRef(true);
    /** Accumulates text deltas in a ref (state is flushed via batched setStreamingText). */
    const streamingTextRef = useRef('');
    /**
     * Tracks whether we are currently inside a streaming request.
     * Used to prevent external callers (e.g. loadSessionDetail) from
     * replacing messages mid-stream, which causes duplicates.
     */
    const isStreamingRef = useRef(false);

    // Track the previous sessionId so we can distinguish session creation
    // (null → id) from session switching (id → different id).
    const prevSessionIdRef = useRef(sessionId);

    // Reset all streaming state when sessionId changes
    useEffect(() => {
        const prevId = prevSessionIdRef.current;
        prevSessionIdRef.current = sessionId;

        // When sessionId goes from null → a value AND we're actively
        // streaming, this is the session-creation flow (server just returned
        // the new run ID). Do NOT abort — the stream is still running for
        // this new session.
        if (!prevId && sessionId && isStreamingRef.current) {
            return;
        }

        // Otherwise this is a session switch (user clicked a different thread
        // or started a new blank session). Abort any in-flight stream and
        // reset state.
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setSending(false);
        isStreamingRef.current = false;
        setStreamStatus("idle");
        setErrorMessage(null);
        setEventStream([]);
        setTimeline([]);
        setTokenUsage(null);
        setRunStartedAt(null);
        setRunEndedAt(null);
        setLastResult(null);
        streamingTextRef.current = '';
        setStreamingText('');
        // Reset first-message flag so title generation works for each new session
        isFirstMessageRef.current = true;
        // Note: messages are NOT reset here — the page component loads them from session detail.
        // Clearing messages here would cause a flash. The page handles setMessages via loadSessionDetail.
    }, [sessionId, workspaceId]);

    /**
     * Guarded setMessages exposed to callers — silently skips during active
     * streaming to prevent loadSessionDetail from overwriting stream state.
     */
    const setMessagesSafe = useCallback<React.Dispatch<React.SetStateAction<Message[]>>>(
        (action) => {
            if (isStreamingRef.current) {
                // During streaming the stream's mergeStreamMessages is the
                // sole owner of the messages state.  External callers
                // (e.g. loadSessionDetail) must not interfere.
                return;
            }
            setMessages(action);
        },
        [],
    );

    const handleStop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setSending(false);
            isStreamingRef.current = false;
            setRunEndedAt(new Date().toISOString());
            setStreamStatus("stopped");

            // Fire-and-forget: notify the server so the run status is updated
            if (sessionId) {
                const headers: Record<string, string> = {};
                if (workspaceId) headers["x-workspace-id"] = workspaceId;
                fetch(`/api/sessions/${sessionId}/stop`, { method: "POST", headers }).catch(() => { });
            }
        }
    }, [sessionId]);

    /**
     * Convert an AgentEvent to a Message for the simple chat view.
     * Returns null for events that shouldn't appear in chat (empty content, system events).
     */
    const eventToMessage = useCallback((e: AgentEvent): Message | null => {
        // Skip system events and events without meaningful content
        if (e.kind === "system") return null;
        if (e.kind !== "user" && e.kind !== "assistant" && e.kind !== "tool") return null;

        // For tool-call events (assistant with tool name but no content), show the tool call
        const hasToolInfo = !!(e.toolName ?? e.name);
        const hasContent = !!e.content?.trim();

        // Skip empty assistant messages that aren't tool calls
        if (e.kind === "assistant" && !hasContent && !hasToolInfo) return null;

        // Strip [System: ...] personality prefix from user messages
        let content = e.content ?? "";
        if (e.kind === "user" && content.startsWith("[System:")) {
            const endBracket = content.indexOf("]\n\n");
            if (endBracket !== -1) {
                content = content.slice(endBracket + 3).trim();
            }
        }

        const normalizedContent = e.kind === "assistant" ? sanitizeVisibleAssistantContent(content) : content;
        // Meta-reasoning content that was sanitized is logged at warn level (replaces debug-fetch instrumentation)
        if (e.kind === "assistant" && /\bwe need to\b|\bfinal answer\b|<think>/i.test(content) && normalizedContent !== content) {
            console.warn('[useSessionStream] Assistant content sanitized in eventToMessage', { eventId: e.id, kind: e.kind });
        }
        return normalizeMessage({
            id: e.id,
            role: e.kind === "tool" ? "tool" : e.kind as "user" | "assistant",
            content: normalizedContent,
            timestamp: e.timestamp,
            toolName: e.toolName ?? e.name,
            toolArgs: e.toolArgs,
            toolCallId: e.toolCallId,
            isError: e.isError,
            thoughts: e.thoughts,
        });
    }, []);

    /**
     * Merge streaming event messages into existing messages (append + dedup by ID).
     * This preserves messages from previous turns loaded via session detail,
     * replaces the optimistic user message, and adds new streaming events.
     *
     * The server-side fix ensures that `continueRun` and `executeRunStreaming`
     * produce matching IDs, so ID-based dedup is sufficient.  Legacy sessions
     * with mismatched IDs (event-continue-* vs event-N) are handled at load
     * time by `loadSessionDetail`.
     */
    const mergeStreamMessages = useCallback((
        eventStream: AgentEvent[],
        optimisticTempId?: string,
    ) => {
        // Convert events to messages
        const rawStreamMessages: Message[] = [];
        for (const event of eventStream) {
            const msg = eventToMessage(event);
            if (msg) rawStreamMessages.push(msg);
        }

        // Dedup consecutive same-role same-content stream messages (the server
        // can emit duplicate assistant events with different IDs, e.g. the
        // agent loop echoing the same response multiple times with 1ms offset)
        const streamMessages: Message[] = [];
        for (const msg of rawStreamMessages) {
            if (streamMessages.length > 0) {
                const prev = streamMessages[streamMessages.length - 1];
                if (
                    prev.role === msg.role &&
                    (prev.content ?? "").trim() === (msg.content ?? "").trim() &&
                    (prev.content ?? "").trim() !== ""
                ) {
                    continue; // skip consecutive duplicate
                }
            }
            streamMessages.push(msg);
        }

        setMessages(prev => {
            const seenIds = new Set<string>();
            const result: Message[] = [];

            // Build a map of stream messages by ID for fast lookup
            const streamById = new Map<string, Message>();
            for (const sm of streamMessages) {
                streamById.set(sm.id, sm);
            }

            // First pass: keep all existing messages, updating any that match stream events
            for (const existing of prev) {
                // Guard: skip if we already emitted this ID (possible when
                // an earlier optimistic-replacement consumed the same ID)
                if (seenIds.has(existing.id)) continue;

                // Replace the optimistic user message with the real one from the stream
                if (optimisticTempId && existing.id === optimisticTempId) {
                    const realUserMsg = streamMessages.find(
                        m => m.role === "user" && m.content === existing.content
                    );
                    if (realUserMsg && !seenIds.has(realUserMsg.id)) {
                        result.push(realUserMsg);
                        seenIds.add(realUserMsg.id);
                        continue;
                    }
                }

                // Update existing message if the stream has a newer version
                const streamVersion = streamById.get(existing.id);
                if (streamVersion) {
                    result.push(streamVersion);
                    seenIds.add(streamVersion.id);
                } else {
                    result.push(existing);
                    seenIds.add(existing.id);
                }
            }

            // Second pass: append genuinely new messages from the stream
            for (const msg of streamMessages) {
                if (!seenIds.has(msg.id)) {
                    result.push(msg);
                    seenIds.add(msg.id);
                }
            }

            // Final pass: remove duplicate assistant messages in merged result.
            // For assistant messages, use content-based dedup (catches duplicates
            // even when tool events separate them, e.g. replayed history).
            // For other roles, keep consecutive dedup only.
            const deduped: Message[] = [];
            const seenAssistantContent = new Set<string>();
            for (const msg of result) {
                if (msg.role === 'assistant' && !msg.toolName && !msg.toolArgs) {
                    // Content-based dedup for non-tool-call assistant messages
                    const key = (msg.content ?? '').trim();
                    if (key && seenAssistantContent.has(key)) continue;
                    if (key) seenAssistantContent.add(key);
                } else if (deduped.length > 0) {
                    // Consecutive dedup for tool/user/system messages
                    const prev = deduped[deduped.length - 1];
                    if (
                        prev.role === msg.role &&
                        (prev.content ?? '').trim() === (msg.content ?? '').trim() &&
                        (prev.content ?? '').trim() !== ''
                    ) {
                        continue;
                    }
                }
                deduped.push(msg);
            }

            return deduped;
        });
    }, [eventToMessage]);

    /**
     * Parse an NDJSON stream response. Used for both create and continue.
     */
    const processNdjsonStream = useCallback(async (
        response: Response,
        controller: AbortController,
        isNewSession: boolean,
        userMessage: string,
        optimisticTempId?: string,
    ) => {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                try {
                    const chunk: StreamChunk = JSON.parse(trimmed);

                    if (chunk.type === "init") {
                        if (isNewSession && onSessionCreated) {
                            onSessionCreated(chunk.payload.runId, chunk.payload.graphId);
                        }
                    } else if (chunk.type === "text_delta") {
                        // Progressive text streaming — accumulate and flush to state
                        streamingTextRef.current += chunk.payload.content;
                        // Meta-reasoning in text deltas is logged at warn level (replaces debug-fetch instrumentation)
                        if (/\bwe need to\b|\bfinal answer\b|<think>/i.test(chunk.payload.content ?? "")) {
                            console.warn('[useSessionStream] Suspicious text delta observed', { delta: (chunk.payload.content ?? '').slice(0, 80) });
                        }
                        setStreamingText(streamingTextRef.current);
                    } else if (chunk.type === "update") {
                        // A full update arrived — clear progressive text since the real
                        // message is now in the event stream
                        if (streamingTextRef.current) {
                            streamingTextRef.current = '';
                            setStreamingText('');
                        }
                        const update = chunk.payload;

                        // Update timeline (full replacement — these are always complete)
                        if (update.timeline?.length) {
                            setTimeline(update.timeline);
                        }

                        // Update event stream (full replacement for timeline view)
                        if (update.eventStream?.length) {
                            setEventStream(update.eventStream);
                            // Merge into chat messages (append + dedup, preserving previous turns)
                            mergeStreamMessages(update.eventStream, optimisticTempId);
                        }

                        // Extract token usage from meta
                        if (update.outputs?.meta) {
                            const meta = update.outputs.meta as Record<string, unknown>;
                            const usage = meta.tokenUsage as TokenUsageForDisplay | undefined;
                            if (usage && typeof usage.totalTokens === "number") {
                                setTokenUsage(usage);
                            }
                        }
                    } else if (chunk.type === "final") {
                        // Final chunk logging (replaces debug-fetch instrumentation)
                        console.debug('[useSessionStream] Final chunk received', { eventStreamCount: chunk.payload.eventStream?.length ?? 0 });
                        // Clear any residual streaming text
                        streamingTextRef.current = '';
                        setStreamingText('');
                        setLastResult(chunk.payload);
                        setRunEndedAt(new Date().toISOString());

                        // Final update of timeline and events
                        if (chunk.payload.timeline?.length) {
                            setTimeline(chunk.payload.timeline);
                        }
                        if (chunk.payload.eventStream?.length) {
                            setEventStream(chunk.payload.eventStream);
                            mergeStreamMessages(chunk.payload.eventStream, optimisticTempId);
                        }

                        // Extract final token usage from result outputs
                        if (chunk.payload.outputs?.meta) {
                            const meta = chunk.payload.outputs.meta as Record<string, unknown>;
                            const usage = meta.tokenUsage as TokenUsageForDisplay | undefined;
                            if (usage && typeof usage.totalTokens === "number") {
                                setTokenUsage(usage);
                            }
                        }

                        // Generate title after first message
                        if (isNewSession && isFirstMessageRef.current && onTitleGenerate) {
                            const runId = chunk.payload.sessionId;
                            onTitleGenerate(runId, userMessage);
                            isFirstMessageRef.current = false;
                        }
                    } else if (chunk.type === "error") {
                        console.error("[useSessionStream] Stream error:", chunk.payload.message);
                        setErrorMessage(chunk.payload.message || "An unknown error occurred.");
                        setStreamStatus("error");
                    }
                } catch (e) {
                    console.error("[useSessionStream] Failed to parse NDJSON chunk:", e);
                }
            }
        }
    }, [onSessionCreated, onTitleGenerate, mergeStreamMessages]);

    const handleSend = useCallback(async (options?: { text?: string }) => {
        const msg = (options?.text ?? input).trim();
        if (!msg || sending) return;
        setInput('');
        setSending(true);
        isStreamingRef.current = true;
        setStreamStatus("streaming");
        setErrorMessage(null);
        setRunStartedAt(new Date().toISOString());
        setRunEndedAt(null);
        streamingTextRef.current = '';
        setStreamingText('');
        isAtBottomRef.current = true;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const isNewSession = !sessionId;
        const url = isNewSession
            ? '/api/sessions'
            : `/api/sessions/${sessionId}/chat`;
        const body = isNewSession
            ? { graphId: selectedGraphId, message: msg, provider: llmProvider, model: llmModel, ...(workspaceId ? { workspaceId } : {}) }
            : { message: msg, provider: llmProvider, model: llmModel };

        // Optimistic user message (temp ID will be replaced by the real event)
        const tempId = `temp-${Date.now()}`;
        setMessages(prev => [...prev, {
            id: tempId,
            role: 'user' as const,
            content: msg,
            timestamp: new Date().toISOString(),
        }]);

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (workspaceId) headers['x-workspace-id'] = workspaceId;

            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(err.error || "Failed to send message");
            }

            await processNdjsonStream(res, controller, isNewSession, msg, tempId);
            setStreamStatus("idle");
        } catch (e: unknown) {
            if ((e as Error).name === 'AbortError') {
                setStreamStatus("stopped");
                // Server-side stop is already handled by handleStop; this is just safety
            } else {
                const errMsg = (e as Error)?.message || "Failed to send message.";
                console.error("[useSessionStream] Error:", errMsg);
                setErrorMessage(errMsg);
                setStreamStatus("error");
            }
            setRunEndedAt(new Date().toISOString());
        } finally {
            if (abortControllerRef.current === controller) {
                setSending(false);
                isStreamingRef.current = false;
                abortControllerRef.current = null;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [input, sending, sessionId, selectedGraphId, llmProvider, llmModel, workspaceId, processNdjsonStream]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    }, [handleSend]);

    const formatTime = useCallback((iso: string) => {
        const date = new Date(iso);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, []);

    return {
        messages,
        setMessages: setMessagesSafe,
        eventStream,
        timeline,
        input,
        setInput,
        sending,
        streamStatus,
        errorMessage,
        tokenUsage,
        runStartedAt,
        runEndedAt,
        streamingText,
        handleSend,
        handleStop,
        handleKeyDown,
        formatTime,
        isAtBottomRef,
        lastResult,
        isStreaming: sending,
    };
}
