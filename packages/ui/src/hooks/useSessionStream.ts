import { useState, useRef, useCallback, useEffect } from 'react';
import type { AgentEvent, AgentWorkflowResult, AgentWorkflowUpdate, TimelineEvent } from '@numezis/shared/types';

// ─── Shared Types (previously in useAgentStream) ─────────────────────────────

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: string;
    toolName?: string;
    toolArgs?: string;
    toolOutput?: string;
    toolCallId?: string;
    thoughts?: string[];
    thinking?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
}

export type StreamStatus = "idle" | "streaming" | "stopped" | "error";

// ─── Utility Functions ───────────────────────────────────────────────────────

function extractThoughtsFromContent(content: string): { content: string; thoughts: string[] } {
    if (!content) {
        return { content, thoughts: [] };
    }

    const thoughts: string[] = [];
    let cleaned = content;

    const addThoughts = (block: string) => {
        const lines = block
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const bulletLines = lines.filter((line) => /^([-*]|\d+\.|\d+\))\s+/.test(line));
        if (bulletLines.length > 0) {
            bulletLines.forEach((line) => {
                thoughts.push(line.replace(/^([-*]|\d+\.|\d+\))\s+/, "").trim());
            });
            return;
        }
        if (lines.length > 1) {
            thoughts.push(...lines);
            return;
        }
        if (block.trim()) {
            thoughts.push(block.trim());
        }
    };

    // Extract explicit <think> blocks
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    let match: RegExpExecArray | null;
    while ((match = thinkRegex.exec(cleaned)) !== null) {
        addThoughts(match[1]);
    }
    cleaned = cleaned.replace(thinkRegex, "").trim();

    // Split on explicit Final/Answer markers
    const finalRegex = /(?:^|\n)\s*(final|answer)\s*:\s*/i;
    const finalMatch = cleaned.match(finalRegex);
    if (finalMatch && finalMatch.index !== undefined) {
        const before = cleaned.slice(0, finalMatch.index).trim();
        const after = cleaned.slice(finalMatch.index + finalMatch[0].length).trim();
        if (after && before) {
            addThoughts(before);
            cleaned = after;
        }
    }

    // Heuristic: if first paragraph looks like reasoning, split it out
    const cueRegex = /\b(we need to|we should|we have|the user|user wants|goal|plan|approach|next step|tool|call|let's|i will)\b/i;
    const paragraphs = cleaned.split(/\n\s*\n/);
    if (paragraphs.length >= 2) {
        const first = paragraphs[0].trim();
        const rest = paragraphs.slice(1).join("\n\n").trim();
        if (rest && cueRegex.test(first)) {
            addThoughts(first);
            cleaned = rest;
        }
    }

    // Guardrail: if policy/prompt-like leakage is present, hide it from visible content.
    if (/\brespond with only the title\b/i.test(cleaned) || /\bshort chat title\b/i.test(cleaned)) {
        addThoughts(cleaned);
        cleaned = "";
    }

    if (!cleaned.trim() && thoughts.length > 0) {
        cleaned = "";
    }

    return { content: cleaned, thoughts };
}

function sanitizeVisibleAssistantContent(content: string): string {
    if (!content) return "";
    const paragraphs = content
        .replace(/<think>[\s\S]*?<\/think>/gi, " ")
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (!paragraphs.length) return "";

    const metaPatterns = [
        /\bwe must obey policy\b/i,
        /\bfinal answer in ["']?final["']? channel\b/i,
        /\bwe should provide a thorough analysis\b/i,
        /\bwe need to include the analysis and final answer\b/i,
        /\bthe user wrote\b/i,
        /\bnow,\s*we need to determine\b/i,
        /\bnow,\s*final answer\b/i,
        /\bgiven the pattern\b/i,
        /\bapproval required\b/i,
        /\bwe can proceed to output a final answer\b/i,
        /\bthe user asked to\b/i,
        /\bwe must not make further tool calls\b/i,
        /\bcopy-?paste exactly\b/i,
        /\bthis should satisfy the user request\b/i,
        /\bnow,\s*the user wants to know\b/i,
        /\bprovide (a )?structured analysis\b/i,
        /\bproceed to final\b/i,
    ];

    const seen = new Set<string>();
    const kept: string[] = [];
    for (const paragraph of paragraphs) {
        if (metaPatterns.some((pattern) => pattern.test(paragraph))) {
            continue;
        }
        const key = paragraph.replace(/\s+/g, " ").trim().toLowerCase();
        if (key.length >= 80 && seen.has(key)) continue;
        if (key.length >= 80) seen.add(key);
        kept.push(paragraph);
    }
    return kept.join("\n\n").trim();
}

export function normalizeMessage(msg: Message): Message {
    if (msg.role !== 'assistant' || !msg.content) return msg;
    const visibleContent = sanitizeVisibleAssistantContent(msg.content);
    if (!visibleContent) {
        return {
            ...msg,
            content: "",
            thoughts: msg.thoughts ?? [],
        };
    }
    if (msg.thoughts && msg.thoughts.length > 0) return msg;
    const extracted = extractThoughtsFromContent(visibleContent);
    if (extracted.thoughts.length === 0) return msg;
    return {
        ...msg,
        content: extracted.content,
        thoughts: extracted.thoughts,
    };
}

// ─── Types ──────────────────────────────────────────────────────────────────

type StreamChunk =
    | { type: "init"; payload: { runId: string; graphId: string } }
    | { type: "update"; payload: AgentWorkflowUpdate }
    | { type: "text_delta"; payload: { content: string } }
    | { type: "final"; payload: AgentWorkflowResult }
    | { type: "error"; payload: { message: string } };

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
    }, [sessionId]);

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
                fetch(`/api/sessions/${sessionId}/stop`, { method: "POST" }).catch(() => {});
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
        if (e.kind === "assistant" && /\bwe need to\b|\bfinal answer\b|<think>/i.test(content) && normalizedContent !== content) {
            // #region agent log
            fetch('http://127.0.0.1:7622/ingest/c818cb08-12c6-4da0-b6be-f7b2dc27eba3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c540e'},body:JSON.stringify({sessionId:'0c540e',runId:sessionId ?? 'unknown',hypothesisId:'H2',location:'packages/ui/src/hooks/useSessionStream.ts:eventToMessage',message:'Assistant content sanitized in eventToMessage',data:{eventId:e.id,before:content.slice(0,180),after:normalizedContent.slice(0,180),kind:e.kind},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
        }
        return normalizeMessage({
            id: e.id,
            role: e.kind === "tool" ? "tool" : e.kind as "user" | "assistant",
            content: normalizedContent,
            timestamp: e.timestamp,
            toolName: e.toolName ?? e.name,
            toolArgs: e.toolArgs,
            toolCallId: e.toolCallId,
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

            // Final pass: remove consecutive same-role same-content in merged result
            // (catches duplicates between existing messages and new stream messages)
            const deduped: Message[] = [];
            for (const msg of result) {
                if (deduped.length > 0) {
                    const prev = deduped[deduped.length - 1];
                    if (
                        prev.role === msg.role &&
                        (prev.content ?? "").trim() === (msg.content ?? "").trim() &&
                        (prev.content ?? "").trim() !== ""
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
                        if (/\bwe need to\b|\bfinal answer\b|<think>/i.test(chunk.payload.content ?? "")) {
                            // #region agent log
                            fetch('http://127.0.0.1:7622/ingest/c818cb08-12c6-4da0-b6be-f7b2dc27eba3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c540e'},body:JSON.stringify({sessionId:'0c540e',runId:sessionId ?? 'new-session',hypothesisId:'H4',location:'packages/ui/src/hooks/useSessionStream.ts:text-delta',message:'Suspicious text delta observed',data:{delta:(chunk.payload.content ?? '').slice(0,180),accumulated:streamingTextRef.current.slice(0,180)},timestamp:Date.now()})}).catch(()=>{});
                            // #endregion
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
                        // #region agent log
                        fetch('http://127.0.0.1:7622/ingest/c818cb08-12c6-4da0-b6be-f7b2dc27eba3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c540e'},body:JSON.stringify({sessionId:'0c540e',runId:sessionId ?? 'new-session',hypothesisId:'H6',location:'packages/ui/src/hooks/useSessionStream.ts:final-chunk',message:'Final chunk received',data:{eventStreamCount:chunk.payload.eventStream?.length ?? 0,timelineCount:chunk.payload.timeline?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
                        // #endregion
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
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
