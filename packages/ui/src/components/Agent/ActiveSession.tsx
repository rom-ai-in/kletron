import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, Brain, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolOutput } from './ToolOutput';
import { ThoughtsPanel } from './ThoughtsPanel';
import { CodeBlock } from './CodeBlock';
import { ChatInput, Modal, Selector } from '@numezis/ui/components/design-system';
import { ContextVisualizer } from '../context/ContextVisualizer';
import { graphOptions } from "@numezis/shared/graphCatalog";
import { useLlmHealth } from '../../hooks/useLlmHealth';
import type { LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";
import { DurationDisplay, TokenUsageDisplay } from "@numezis/ui/components/Agent/metrics";

type LlmEnvInfo = {
    defaultProvider?: "azure" | "lmstudio";
    azure?: {
        configured: boolean;
        endpoint?: string | null;
        deployment?: string | null;
        model?: string | null;
        apiVersion?: string | null;
    };
    lmstudio?: {
        configured: boolean;
        baseUrl?: string | null;
        model?: string | null;
    };
};

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: string;
    toolName?: string;
    toolArgs?: string;
    toolOutput?: string;
    toolCallId?: string; // Added for matching
    thoughts?: string[];
    thinking?: string; // Legacy support
    metadata?: Record<string, any>;
}

interface PendingEdit {
    id: string;
    conversationId: string;
    toolName: string;
    args: Record<string, any>;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    description?: string;
}

type AgentGraphRecord = {
    _id?: string;
    name: string;
    description?: string;
};

interface ActiveSessionProps {
    conversationId: string;
    title: string;
    onApproveEdit: (editId: string) => void;
    onApproveAll?: () => void;
    onRejectEdit?: (editId: string) => void;
    onRejectAll?: () => void;
    onTitleChange?: (newTitle: string) => void;
    showGraphSelector?: boolean;
    showContextButtons?: boolean;
    workspaceId?: string;
}

export const ActiveSession: React.FC<ActiveSessionProps> = ({
    conversationId,
    title,
    onApproveEdit,
    onApproveAll,
    onRejectEdit,
    onRejectAll,
    onTitleChange,
    showGraphSelector = true,
    showContextButtons = true,
    workspaceId,
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
    const [isGraphOpen, setIsGraphOpen] = useState(false);
    const [expandedEditId, setExpandedEditId] = useState<string | null>(null);
    const [approvingAll, setApprovingAll] = useState(false);
    const [rejectingAll, setRejectingAll] = useState(false);

    const [llmProvider, setLlmProvider] = useState<string>('azure');
    const [enabledProviders, setEnabledProviders] = useState<LlmProviderType[]>([]);
    const [llmPrefsLoaded, setLlmPrefsLoaded] = useState(false);
    const [enabledProvidersLoaded, setEnabledProvidersLoaded] = useState(false);
    const [selectedGraphId, setSelectedGraphId] = useState<string>("");
    const [agentGraphs, setAgentGraphs] = useState<AgentGraphRecord[]>([]);
    const [graphOptionsLoaded, setGraphOptionsLoaded] = useState(false);
    const [savedGraphId, setSavedGraphId] = useState<string | null>(null);
    const [envInfo, setEnvInfo] = useState<LlmEnvInfo | null>(null);
    const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
    const [runEndedAt, setRunEndedAt] = useState<string | null>(null);
    const [tokenUsage, setTokenUsage] = useState<{
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        callCount: number;
        model?: string;
    } | null>(null);
    const [streamStatus, setStreamStatus] = useState<"idle" | "streaming" | "stopped" | "error">("idle");

    const extractThoughtsFromContent = useCallback((content: string) => {
        if (!content) {
            return { content, thoughts: [] as string[] };
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
    }, []);

    const normalizeMessage = useCallback(
        (msg: Message): Message => {
            if (msg.role !== 'assistant' || !msg.content) return msg;
            if (msg.thoughts && msg.thoughts.length > 0) return msg;
            const extracted = extractThoughtsFromContent(msg.content);
            if (extracted.thoughts.length === 0) return msg;
            return {
                ...msg,
                content: extracted.content,
                thoughts: extracted.thoughts,
            };
        },
        [extractThoughtsFromContent]
    );

    const { status: llmStatus } = useLlmHealth(llmProvider); // Use hook

    useEffect(() => {
        const fetchPreferences = async () => {
            try {
                // Fetch env info first
                const envRes = await fetch("/api/env");
                const envData = await envRes.json();
                const envLLM = envData.llm as LlmEnvInfo;
                setEnvInfo(envLLM);

                // Try to fetch user preferences from API
                const prefsRes = await fetch("/api/user-preferences");
                if (prefsRes.ok) {
                    const prefsData = await prefsRes.json();
                    if (prefsData.success && prefsData.preferences) {
                        const { selectedLlmProvider, selectedGraphId: prefGraphId } = prefsData.preferences;
                        if (selectedLlmProvider) {
                            setLlmProvider(selectedLlmProvider);
                        } else {
                            // Fallback to localStorage then env
                            const stored = window.localStorage.getItem("numezis-llm-selection");
                            if (stored) {
                                try {
                                    const parsed = JSON.parse(stored);
                                    if (parsed.provider) setLlmProvider(parsed.provider);
                                } catch { }
                            } else {
                                setLlmProvider(envLLM?.defaultProvider || 'azure');
                            }
                        }
                        if (prefGraphId) {
                            setSavedGraphId(prefGraphId);
                        } else {
                            // Fallback to localStorage
                            const storedGraph = window.localStorage.getItem("numezis-graph-selection");
                            if (storedGraph) {
                                setSavedGraphId(storedGraph);
                            }
                        }
                        return;
                    }
                }

                // Fallback to localStorage if API fails or user not authenticated
                const stored = window.localStorage.getItem("numezis-llm-selection");
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed.provider) setLlmProvider(parsed.provider);
                    } catch { }
                } else {
                    setLlmProvider(envLLM?.defaultProvider || 'azure');
                }

                const storedGraph = window.localStorage.getItem("numezis-graph-selection");
                if (storedGraph) {
                    setSavedGraphId(storedGraph);
                }
            } catch (e) {
                console.error("Failed to fetch preferences", e);
            } finally {
                setLlmPrefsLoaded(true);
            }
        };
        fetchPreferences();
    }, []);

    useEffect(() => {
        let cancelled = false;
        const loadGraphs = async () => {
            try {
                const res = await fetch("/api/agent-graphs", { cache: "no-store" });
                if (!res.ok) throw new Error("Failed to load graphs");
                const data = await res.json();
                const list = Array.isArray(data?.graphs) ? (data.graphs as AgentGraphRecord[]) : [];
                if (!cancelled) {
                    setAgentGraphs(list);
                    setGraphOptionsLoaded(true);
                }
            } catch {
                if (!cancelled) {
                    setAgentGraphs([]);
                    setGraphOptionsLoaded(true);
                }
            }
        };
        void loadGraphs();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!graphOptionsLoaded) return;
        const hasAgentGraphs = agentGraphs.length > 0;
        const defaultGraphId = hasAgentGraphs
            ? (agentGraphs.find((g) => g.name === "Simple ReAct (agent graph)")?._id ||
                agentGraphs[0]?._id ||
                "")
            : (graphOptions[0]?.id || "universal-v1");
        const savedIsValid = savedGraphId
            ? hasAgentGraphs
                ? agentGraphs.some((g) => String(g._id) === savedGraphId)
                : graphOptions.some((g) => g.id === savedGraphId)
            : false;
        const nextGraphId = savedIsValid ? savedGraphId! : defaultGraphId;
        if (nextGraphId && nextGraphId !== selectedGraphId) {
            setSelectedGraphId(nextGraphId);
        }
    }, [graphOptionsLoaded, agentGraphs, savedGraphId, selectedGraphId]);

    useEffect(() => {
        fetch("/api/llm-config/enable")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data.enabledProviders)) {
                    setEnabledProviders(data.enabledProviders);
                } else {
                    setEnabledProviders([]);
                }
            })
            .catch((err) => {
                console.error("Failed to fetch enabled providers", err);
                setEnabledProviders([]);
            })
            .finally(() => {
                setEnabledProvidersLoaded(true);
            });
    }, []);

    useEffect(() => {
        if (!enabledProvidersLoaded || enabledProviders.length === 0) return;
        if (!enabledProviders.includes(llmProvider as LlmProviderType)) {
            const nextProvider = enabledProviders[0];
            if (nextProvider) {
                handleLlmChange(nextProvider);
            }
        }
    }, [enabledProvidersLoaded, enabledProviders, llmProvider]);

    const handleLlmChange = (provider: string) => {
        setLlmProvider(provider);
        // Save to localStorage as fallback
        window.localStorage.setItem("numezis-llm-selection", JSON.stringify({ provider, model: provider === 'azure' ? envInfo?.azure?.model : envInfo?.lmstudio?.model }));
        // Persist to API (fire-and-forget, don't block UI)
        fetch("/api/user-preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedLlmProvider: provider }),
        }).catch(() => { /* Silently fail, localStorage is fallback */ });
    };

    const handleGraphChange = (graphId: string) => {
        setSelectedGraphId(graphId);
        // Save to localStorage as fallback
        window.localStorage.setItem("numezis-graph-selection", graphId);
        // Persist to API (fire-and-forget, don't block UI)
        fetch("/api/user-preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedGraphId: graphId }),
        }).catch(() => { /* Silently fail, localStorage is fallback */ });
    };

    const llmOptions = [
        {
            id: 'azure',
            label: 'Azure OpenAI',
            sub: envInfo?.azure?.model || 'Not configured'
        },
        {
            id: 'openai',
            label: 'OpenAI',
            sub: 'gpt-4o'
        },
        {
            id: 'claude',
            label: 'Claude',
            sub: 'claude-sonnet-4'
        },
        {
            id: 'gemini',
            label: 'Gemini',
            sub: 'gemini-2.5-flash'
        },
        {
            id: 'lmstudio',
            label: 'LM Studio',
            sub: envInfo?.lmstudio?.model || 'Not configured'
        },
        {
            id: 'ollama',
            label: 'Ollama',
            sub: 'qwen2.5:14b'
        }
    ].filter((option) => enabledProviders.includes(option.id as LlmProviderType));

    const graphSelectOptions = (agentGraphs.length > 0 ? agentGraphs : graphOptions).map((g: any) => ({
        id: g._id ?? g.id,
        label: g.name,
        sub: g.description
    }));

    // Auto-scroll ref
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);
    const loadAbortRef = useRef<AbortController | null>(null);
    const loadInFlightRef = useRef(false);

    const checkIsAtBottom = () => {
        if (!scrollContainerRef.current) return true;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        // Tolerance of 50px
        return scrollHeight - scrollTop - clientHeight < 50;
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        isAtBottomRef.current = checkIsAtBottom();
    };

    const loadData = useCallback(async (options?: { force?: boolean }) => {
        if (!conversationId) return;
        if (loadInFlightRef.current) {
            if (!options?.force) return;
            if (loadAbortRef.current) {
                loadAbortRef.current.abort();
                loadAbortRef.current = null;
            }
        }
        loadInFlightRef.current = true;
        const controller = new AbortController();
        loadAbortRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
            // Load messages
            const workspaceQuery = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
            const [res, editsRes] = await Promise.all([
                fetch(`/api/agent/${conversationId}${workspaceQuery}`, {
                    signal: controller.signal,
                    cache: "no-store",
                    credentials: "include",
                }),
                fetch(`/api/agent/edits?conversationId=${conversationId}`, {
                    signal: controller.signal,
                    cache: "no-store",
                    credentials: "include",
                }),
            ]);

            if (res.ok) {
                const data = await res.json();
                const nextMessages = Array.isArray(data.messages) ? data.messages.map(normalizeMessage) : [];
                setMessages(nextMessages);
            }

            if (editsRes.ok) {
                const edits = await editsRes.json();
                setPendingEdits(edits);
            }
        } catch (e) {
            if ((e as Error).name !== "AbortError") {
                console.error("Failed to load session data", e);
            }
        } finally {
            clearTimeout(timeoutId);
            if (loadAbortRef.current === controller) {
                loadAbortRef.current = null;
            }
            loadInFlightRef.current = false;
        }
    }, [conversationId, workspaceId, normalizeMessage]);

    useEffect(() => {
        let cancelled = false;
        const tick = () => {
            if (cancelled) return;
            if (document.visibilityState === "hidden") return;
            void loadData();
        };

        tick();
        const interval = setInterval(tick, 3000); // Poll for updates
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                tick();
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            cancelled = true;
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            if (loadAbortRef.current) {
                loadAbortRef.current.abort();
                loadAbortRef.current = null;
            }
            loadInFlightRef.current = false;
        };
    }, [loadData]);

    useEffect(() => {
        if (isAtBottomRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, pendingEdits]);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setSending(false);
            setRunEndedAt(new Date().toISOString());
            setStreamStatus("stopped");
        }
    };

    const handleSend = async () => {
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

                            // If it's the user message echoing back, replace the optimistic one
                            // Or generally, just merge into messages
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
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.log("Request aborted by user");
                setStreamStatus("stopped");
            } else {
                console.error(e);
                setStreamStatus("error");
                // Keep the input if it failed?
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
    };



    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Enter to send, Shift+Enter for new line
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    };

    const formatTime = (iso: string) => {
        const date = new Date(iso);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Focus ref
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // Focus input on load/switch
        textareaRef.current?.focus();
    }, [conversationId]);

    useEffect(() => {
        setRunStartedAt(null);
        setRunEndedAt(null);
        setTokenUsage(null);
        setStreamStatus("idle");
    }, [conversationId]);

    return (
        <div className="flex flex-col h-full bg-bg-surface">
            {/* Messages Area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-2 scrollbar-elegant"
            >
                {(runStartedAt || tokenUsage) && (
                    <div className="sticky top-0 z-10 mb-2 flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface/90 px-3 py-2 backdrop-blur">
                        <TokenUsageDisplay tokenUsage={tokenUsage} />
                        {tokenUsage?.callCount ? (
                            <span className="text-[10px] font-mono text-text-muted">
                                {tokenUsage.callCount} calls
                            </span>
                        ) : null}
                        {tokenUsage?.model ? (
                            <span className="text-[10px] font-mono text-text-muted">
                                {tokenUsage.model}
                            </span>
                        ) : null}
                        <DurationDisplay startedAt={runStartedAt} endedAt={runEndedAt} />
                    </div>
                )}
                {messages.map((m, i) => {
                    const isUser = m.role === 'user';
                    const isSystem = m.role === 'system';
                    const isTool = m.role === 'tool';
                    const isAssistant = m.role === 'assistant';

                    if (isSystem) return null;


                    // TOOL MESSAGE (Output) - content is handled within the invocating assistant message
                    if (isTool) return null;

                    // ASSISTANT / USER MESSAGE
                    return (
                        <div key={m.id || i} className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'} ${m.toolName ? 'mb-0' : 'mb-1'}`}>

                            {/* Thoughts / Planning (Only for Assistant) */}
                            {isAssistant && (
                                <div className="w-full max-w-[95%] mb-1">
                                    {(m.thoughts && m.thoughts.length > 0) ? (
                                        <ThoughtsPanel thoughts={m.thoughts} />
                                    ) : m.thinking ? (
                                        // Legacy fallback
                                        <ThoughtsPanel thoughts={[m.thinking]} isReasoning={true} />
                                    ) : null}
                                </div>
                            )}

                            {/* Main Message Bubble */}
                            <div className={`relative rounded-lg ${m.toolName ? 'p-0' : 'px-3 py-2'} ${isUser
                                ? 'shadow-sm border border-border-strong bg-bg-elevated text-text-primary max-w-[90%]'
                                : 'bg-transparent pl-0 pt-0 w-full'
                                }`}>

                                {/* Tool Call Indicator (Merged with output) */}
                                {m.toolName && (
                                    <ToolInvocation
                                        name={m.toolName}
                                        args={m.toolArgs}
                                        output={(() => {
                                            // 1. Try to find by explicit toolCallId
                                            if (m.toolCallId) {
                                                const outputMsg = messages.find(om => om.role === 'tool' && om.toolCallId === m.toolCallId);
                                                if (outputMsg) return outputMsg.content || outputMsg.toolOutput;
                                            }
                                            // 2. Fallback: Check immediate next message (legacy behavior)
                                            const nextMsg = messages[i + 1];
                                            if (nextMsg?.role === 'tool') {
                                                return nextMsg.content || nextMsg.toolOutput;
                                            }
                                            return undefined;
                                        })()}
                                    />
                                )}

                                <div className={`text-[12px] break-words ${isUser ? 'text-text-primary' : 'text-text-secondary'}`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            pre: ({ children }: any) => <>{children}</>,
                                            p: ({ children }: any) => <p className="mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-text-secondary">{children}</p>,
                                            ul: ({ children }: any) => <ul className="list-disc pl-3.5 mb-0.5 space-y-0 marker:text-text-muted">{children}</ul>,
                                            ol: ({ children }: any) => <ol className="list-decimal pl-3.5 mb-0.5 space-y-0 marker:text-text-muted">{children}</ol>,
                                            li: ({ children }: any) => <li className="pl-0.5 whitespace-normal leading-[1.35]">{children}</li>,
                                            h1: ({ children }: any) => <h1 className="font-bold text-sm text-text-primary mt-1.5 mb-0.5">{children}</h1>,
                                            h2: ({ children }: any) => <h2 className="font-semibold text-sm text-text-primary mt-1.5 mb-0.5">{children}</h2>,
                                            h3: ({ children }: any) => <h3 className="font-medium text-[13px] text-text-primary mt-1 mb-0.5">{children}</h3>,
                                            h4: ({ children }: any) => <h4 className="font-medium text-[12px] text-text-primary mt-1 mb-0.5">{children}</h4>,
                                            a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-text-primary underline decoration-border-strong/60 hover:decoration-border-strong">{children}</a>,
                                            blockquote: ({ children }: any) => <blockquote className="border-l-2 border-border-subtle pl-2 italic text-text-muted my-0.5">{children}</blockquote>,
                                            code: ({ node, inline, className, children, ...props }: any) => (
                                                <CodeBlock inline={inline} className={className} {...props}>
                                                    {children}
                                                </CodeBlock>
                                            )
                                        }}
                                    >
                                        {m.content}
                                    </ReactMarkdown>
                                </div>

                                {/* Timestamp Footer - Only for Assistant Messages (Non-tool) */}
                                {isAssistant && !m.toolName && (
                                    <div className="mt-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-start">
                                        <span className="text-[9px] text-text-muted font-mono">{formatTime(m.timestamp)}</span>
                                        <CopyButton content={m.content} />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Cursor-Style Changes Review Panel */}
                {pendingEdits.length > 0 && (
                    <div className="mt-4 mx-2 bg-bg-elevated/80 border border-amber-500/40 rounded-lg shadow-xl overflow-hidden">
                        {/* Header with Batch Actions */}
                        <div className="flex items-center justify-between px-3 py-2 bg-bg-surface border-b border-border-subtle">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                <span className="text-[11px] font-semibold text-amber-400">
                                    {pendingEdits.length} Pending Change{pendingEdits.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={async () => {
                                        setApprovingAll(true);
                                        try {
                                            if (onApproveAll) {
                                                await onApproveAll();
                                            } else {
                                                // Fallback: approve each individually
                                                for (const edit of pendingEdits) {
                                                    await onApproveEdit(edit.id);
                                                }
                                            }
                                            await loadData();
                                        } finally {
                                            setApprovingAll(false);
                                        }
                                    }}
                                    disabled={approvingAll || rejectingAll}
                                    className="py-1 px-2.5 bg-green-900/40 hover:bg-green-800/60 text-green-400 border border-green-700/50 hover:border-green-600 rounded text-[10px] font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                                >
                                    {approvingAll ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                                    Accept All
                                </button>
                                <button
                                    onClick={async () => {
                                        setRejectingAll(true);
                                        try {
                                            if (onRejectAll) {
                                                await onRejectAll();
                                            }
                                            await loadData();
                                        } finally {
                                            setRejectingAll(false);
                                        }
                                    }}
                                    disabled={approvingAll || rejectingAll}
                                    className="py-1 px-2.5 bg-bg-surface hover:bg-rose-500/10 text-text-muted hover:text-rose-400 border border-border-subtle hover:border-rose-500/40 rounded text-[10px] font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                                >
                                    {rejectingAll ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                                    Reject All
                                </button>
                            </div>
                        </div>

                        {/* File List */}
                        <div className="divide-y divide-border-subtle">
                            {pendingEdits.map(edit => {
                                const isExpanded = expandedEditId === edit.id;
                                const filePath = edit.args?.filePath || edit.args?.path || 'Unknown file';
                                const fileName = filePath.split('/').pop() || filePath;
                                const isCreate = edit.toolName === 'write_file';
                                const content = edit.args?.content || '';

                                return (
                                    <div key={edit.id} className="group">
                                        {/* File Header - Click to Expand */}
                                        <button
                                            onClick={() => setExpandedEditId(isExpanded ? null : edit.id)}
                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-state-hover transition-colors text-left"
                                        >
                                            <ChevronRight
                                                size={12}
                                                className={`text-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                            />
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isCreate ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-amber-900/30 text-amber-400 border border-amber-800/50'}`}>
                                                {isCreate ? 'NEW' : 'EDIT'}
                                            </span>
                                            <span className="text-[11px] font-mono text-text-secondary truncate flex-1">
                                                {fileName}
                                            </span>
                                            <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                                {formatTime(edit.createdAt)}
                                            </span>
                                        </button>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="px-3 pb-3 pt-1 bg-bg-surface">
                                                {/* File Path */}
                                                <div className="text-[9px] font-mono text-text-muted mb-2 truncate">
                                                    {filePath}
                                                </div>

                                                {/* Content Preview */}
                                                {content && (
                                                    <div className="bg-bg-elevated border border-border-subtle rounded p-2 mb-2 overflow-hidden">
                                                        <pre className="text-[10px] font-mono text-text-muted whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-elegant">
                                                            {content.length > 500 ? content.substring(0, 500) + '\n... (truncated)' : content}
                                                        </pre>
                                                    </div>
                                                )}

                                                {/* Individual Actions */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => onApproveEdit(edit.id)}
                                                        className="flex-1 py-1.5 px-3 bg-green-900/30 hover:bg-green-800/50 text-green-400 border border-green-700/50 hover:border-green-600 rounded flex items-center justify-center gap-1.5 transition-all text-[10px] font-medium"
                                                    >
                                                        <CheckCircle size={11} /> Accept
                                                    </button>
                                                    <button
                                                        onClick={() => onRejectEdit?.(edit.id)}
                                                        className="flex-1 py-1.5 px-3 bg-bg-surface hover:bg-rose-500/10 text-text-muted hover:text-rose-400 border border-border-subtle hover:border-rose-500/40 rounded flex items-center justify-center gap-1.5 transition-all text-[10px] font-medium"
                                                    >
                                                        <XCircle size={11} /> Reject
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {sending && (
                    <div className="flex items-center gap-2 ml-1 opacity-70">
                        <Loader2 className="w-3 h-3 animate-spin text-text-muted" />
                        <span className="text-[10px] italic text-text-muted">Agent is thinking...</span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="sticky bottom-0 border-t border-border-subtle bg-bg-surface px-4 py-4 backdrop-blur-md">
                <div className="mx-auto max-w-4xl">
                    <ChatInput
                        ref={textareaRef}
                        value={input}
                        onChange={setInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything (⌘L), @ to mention, / for workflows"
                        sending={sending}
                        onSend={() => void handleSend()}
                        onStop={handleStop}
                        footerLeft={(
                            <div className="flex items-center gap-2">
                                {showContextButtons && (
                                    <button
                                        type="button"
                                        onClick={() => setIsGraphOpen(true)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                                        title="View Context Graph"
                                    >
                                        <Brain className="h-4 w-4" />
                                    </button>
                                )}
                                {showGraphSelector && (
                                    <Selector
                                        label="GRAPH"
                                        value={selectedGraphId}
                                        options={graphSelectOptions}
                                        onSelect={handleGraphChange}
                                        direction="up"
                                        size="sm"
                                        loading={!graphOptionsLoaded}
                                    />
                                )}
                                <Selector
                                    label="LLM"
                                    value={llmProvider}
                                    options={llmOptions}
                                    onSelect={handleLlmChange}
                                    direction="up"
                                    size="sm"
                                    status={llmStatus}
                                    loading={!llmPrefsLoaded || !enabledProvidersLoaded}
                                />
                            </div>
                        )}
                    />
                    <div className="mt-1 flex items-center justify-end text-[10px] text-text-muted">
                        <span
                            className={
                                streamStatus === "streaming"
                                    ? "text-emerald-400"
                                    : streamStatus === "stopped"
                                        ? "text-amber-400"
                                        : streamStatus === "error"
                                            ? "text-rose-400"
                                            : "text-text-muted"
                            }
                        >
                            {streamStatus === "streaming"
                                ? "Streaming"
                                : streamStatus === "stopped"
                                    ? "Stopped"
                                    : streamStatus === "error"
                                        ? "Reconnecting"
                                        : "Idle"}
                        </span>
                    </div>
                </div>
            </div>

            {showContextButtons && (
                <>
                    {/* Context Graph Modal */}
                    <Modal
                        open={isGraphOpen}
                        onClose={() => setIsGraphOpen(false)}
                        title="Context Graph Visualizer"
                        subtitle="Live Agent Context Memory"
                        fullHeight
                    >
                        <ContextVisualizer />
                    </Modal>

                </>
            )}

        </div>
    );
};

const CopyButton = ({ content }: { content: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="ml-2 p-1 text-text-muted hover:text-text-primary transition-colors"
            title="Copy message"
        >
            {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
        </button>
    );
};

const ToolInvocation: React.FC<{ name: string; args?: string; output?: string }> = ({ name, args, output }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Parse args to get a friendly display value
    const getDisplayInfo = () => {
        let displayArgs = "";
        let displayName = name;

        try {
            const parsed = args ? JSON.parse(args) : {};

            if (name === 'grep_search') {
                displayName = "Grepped";
                displayArgs = parsed.Query || parsed.query || "";
                if (parsed.SearchPath || parsed.path) displayArgs += ` in ${parsed.SearchPath || parsed.path}`;
            } else if (name === 'read_file' || name === 'view_file') {
                displayName = "Read";
                // precise filename only
                const path = parsed.AbsolutePath || parsed.path || "";
                displayArgs = path.split('/').pop() || path;
            } else if (name === 'list_dir') {
                displayName = "Listed";
                const path = parsed.DirectoryPath || parsed.path || "";
                displayArgs = path.split('/').pop() || path;
            } else if (name === 'run_command') {
                displayName = "Ran";
                displayArgs = parsed.CommandLine || parsed.command || "";
            } else if (name === 'replace_file_content' || name === 'write_to_file') {
                displayName = name === 'write_to_file' ? "Created" : "Edited";
                const path = parsed.TargetFile || parsed.path || "";
                displayArgs = path.split('/').pop() || path;
            } else if (name === 'codebase_search') {
                displayName = "Searched code";
                displayArgs = parsed.query || "";
            }
        } catch (e) {
            displayArgs = args || "";
        }

        return { displayName, displayArgs };
    };

    const { displayName, displayArgs } = getDisplayInfo();

    return (
        <div className="mb-0 group/tool">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 w-full text-left py-0.5 hover:bg-state-hover rounded px-1 -ml-1 transition-colors"
            >
                <div className={`text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                    <ChevronRight size={12} />
                </div>
                <div className="flex items-center gap-2 text-[11px] overflow-hidden">
                    <span className="font-semibold text-text-secondary">{displayName}</span>
                    <span className="text-text-muted truncate max-w-[300px] font-mono">{displayArgs}</span>
                </div>
            </button>

            {isOpen && output && (
                <div className="pl-5 mt-0.5 border-l border-border-subtle ml-1.5 pb-2">
                    <div className="text-[10px] text-text-muted mb-1 font-mono bg-bg-elevated p-1.5 rounded inline-block max-w-full truncate">
                        {name}({args ? args.substring(0, 100) + (args.length > 100 ? '...' : '') : ''})
                    </div>
                    <ToolOutput output={output} />
                </div>
            )}
        </div>
    );
};

// Add ChevronRight to imports if not present
import { ChevronRight } from 'lucide-react';
