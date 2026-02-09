import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

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

export interface UseAgentStreamOptions {
    conversationId: string;
    loadData: (options?: { force?: boolean }) => Promise<void>;
    selectedGraphId: string;
    llmProvider: string;
    showGraphSelector: boolean;
    workspaceId?: string;
    title: string;
    onTitleChange?: (newTitle: string) => void;
}

export interface UseAgentStreamReturn {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    input: string;
    setInput: (value: string) => void;
    sending: boolean;
    runStartedAt: string | null;
    runEndedAt: string | null;
    tokenUsage: {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        callCount: number;
        model?: string;
    } | null;
    streamStatus: StreamStatus;
    handleSend: () => Promise<void>;
    handleStop: () => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    formatTime: (iso: string) => string;
    normalizeMessage: (msg: Message) => Message;
    isAtBottomRef: React.MutableRefObject<boolean>;
}

// ─── Utility Functions ──────────────────────────────────────────────────────

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

    if (!cleaned.trim() && thoughts.length > 0) {
        cleaned = content.trim();
    }

    return { content: cleaned, thoughts };
}

export function normalizeMessage(msg: Message): Message {
    if (msg.role !== 'assistant' || !msg.content) return msg;
    if (msg.thoughts && msg.thoughts.length > 0) return msg;
    const extracted = extractThoughtsFromContent(msg.content);
    if (extracted.thoughts.length === 0) return msg;
    return {
        ...msg,
        content: extracted.content,
        thoughts: extracted.thoughts,
    };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAgentStream(options: UseAgentStreamOptions): UseAgentStreamReturn {
    const {
        conversationId,
        loadData,
        selectedGraphId,
        llmProvider,
        showGraphSelector,
        workspaceId,
        title,
        onTitleChange,
    } = options;

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
    const [runEndedAt, setRunEndedAt] = useState<string | null>(null);
    const [tokenUsage, setTokenUsage] = useState<{
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        callCount: number;
        model?: string;
    } | null>(null);
    const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");

    const abortControllerRef = useRef<AbortController | null>(null);
    const isAtBottomRef = useRef(true);

    // Reset stream state when conversation changes
    useEffect(() => {
        setRunStartedAt(null);
        setRunEndedAt(null);
        setTokenUsage(null);
        setStreamStatus("idle");
    }, [conversationId]);

    const handleStop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setSending(false);
            setRunEndedAt(new Date().toISOString());
            setStreamStatus("stopped");
        }
    }, []);

    const handleSend = useCallback(async () => {
        if (!input.trim() || sending) return;
        const msg = input;
        setInput('');
        setSending(true);
        setStreamStatus("streaming");
        const startedAt = new Date().toISOString();
        setRunStartedAt(startedAt);
        setRunEndedAt(null);
        setTokenUsage({
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
            callCount: 0,
        });
        isAtBottomRef.current = true; // Force scroll on user send

        // Optimistic update
        const tempId = `temp-${Date.now()}`;
        const optimisticMsg: Message = {
            id: tempId,
            role: 'user',
            content: msg,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const retryStreamSync = async () => {
            const delays = [1000, 2000, 4000];
            for (const delay of delays) {
                await new Promise(resolve => setTimeout(resolve, delay));
                await loadData({ force: true });
            }
        };

        try {
            const res = await fetch(`/api/agent/${conversationId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    ...(showGraphSelector ? { graphId: selectedGraphId } : {}),
                    llmProvider,
                    ...(workspaceId ? { workspaceId } : {}),
                }),
                signal: controller.signal
            });

            if (!res.ok) throw new Error("Failed to send");

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error("No reader");

            let buffer = '';
            let completed = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // Keep the incomplete part

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') {
                            setRunEndedAt(new Date().toISOString());
                            completed = true;
                            break;
                        }

                        try {
                            const event = JSON.parse(dataStr);

                            if (event?.metadata?.type === "token_usage" && event?.metadata?.tokenUsage) {
                                const usage = event.metadata.tokenUsage;
                                setTokenUsage((prev) => ({
                                    totalInputTokens: usage.totalInputTokens ?? prev?.totalInputTokens ?? 0,
                                    totalOutputTokens: usage.totalOutputTokens ?? prev?.totalOutputTokens ?? 0,
                                    totalTokens: usage.totalTokens ?? prev?.totalTokens ?? 0,
                                    callCount: usage.callCount ?? prev?.callCount ?? 0,
                                    model: event.metadata?.model ?? prev?.model,
                                }));
                                continue;
                            }

                            // Merge into messages
                            const normalizedEvent = normalizeMessage(event);
                            setMessages(prev => {
                                // If we have the optimistic message, and this is the user message (same content), replace it
                                if (normalizedEvent.role === 'user' && normalizedEvent.content === msg) {
                                    return prev.map(m => m.id === tempId ? normalizedEvent : m);
                                }
                                const existingIndex = prev.findIndex(m => m.id === normalizedEvent.id);
                                if (existingIndex === -1) return [...prev, normalizedEvent];
                                const next = [...prev];
                                next[existingIndex] = { ...prev[existingIndex], ...normalizedEvent };
                                return next;
                            });

                        } catch (e) {
                            console.error("Failed to parse SSE event", e);
                        }
                    }
                }
            }

            if (!completed) {
                setRunEndedAt((prev) => prev ?? new Date().toISOString());
            }

            // Final sync to be sure
            await loadData({ force: true });
            setStreamStatus("idle");
        } catch (e: unknown) {
            if ((e as Error).name === 'AbortError') {
                console.info("Request aborted by user");
                setStreamStatus("stopped");
            } else {
                console.error(e);
                setStreamStatus("error");
                await retryStreamSync();
                setStreamStatus("idle");
            }
            setRunEndedAt(new Date().toISOString());
        } finally {
            if (abortControllerRef.current === controller) {
                setSending(false);
                abortControllerRef.current = null;
            }
        }

        // Generate title if this is the first user message and title is still default
        if (title === "New Chat" && msg.trim()) {
            try {
                const res = await fetch('/api/agent/generate-title', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ conversationId, userMessage: msg, ...(workspaceId ? { workspaceId } : {}) })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.title && onTitleChange) {
                        onTitleChange(data.title);
                    }
                }
            } catch (e) {
                console.error("Failed to generate title:", e);
            }
        }
    }, [input, sending, conversationId, loadData, selectedGraphId, llmProvider, showGraphSelector, workspaceId, title, onTitleChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Enter to send, Shift+Enter for new line
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
        setMessages,
        input,
        setInput,
        sending,
        runStartedAt,
        runEndedAt,
        tokenUsage,
        streamStatus,
        handleSend,
        handleStop,
        handleKeyDown,
        formatTime,
        normalizeMessage,
        isAtBottomRef,
    };
}
