import React, { useEffect, useState, useRef } from 'react';
import { Send, Loader2, Play, CheckCircle, XCircle, Clock, Wrench, Brain, Terminal, StopCircle, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolOutput } from './ToolOutput';
import { ThoughtsPanel } from './ThoughtsPanel';
import { CodeBlock } from './CodeBlock';
import { Selector, Modal } from '@/src/components/design-system';
import { ContextVisualizer } from '../context/ContextVisualizer';
import { graphOptions } from '../../shared/graphCatalog';
import { useLlmHealth } from '../../hooks/useLlmHealth';
import { AgentAuditModal } from './AgentAuditModal';

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

interface ActiveSessionProps {
    conversationId: string;
    title: string;
    onApproveEdit: (editId: string) => void;
    onApproveAll?: () => void;
    onRejectEdit?: (editId: string) => void;
    onRejectAll?: () => void;
    onTitleChange?: (newTitle: string) => void;
}

export const ActiveSession: React.FC<ActiveSessionProps> = ({ conversationId, title, onApproveEdit, onApproveAll, onRejectEdit, onRejectAll, onTitleChange }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
    const [isPromptSelectorOpen, setIsPromptSelectorOpen] = useState(false);
    const [isGraphOpen, setIsGraphOpen] = useState(false);
    const [expandedEditId, setExpandedEditId] = useState<string | null>(null);
    const [approvingAll, setApprovingAll] = useState(false);
    const [rejectingAll, setRejectingAll] = useState(false);

    const [llmProvider, setLlmProvider] = useState<string>('azure');
    const [isAuditOpen, setIsAuditOpen] = useState(false); // New state for Audit Log
    const [selectedGraphId, setSelectedGraphId] = useState<string>(graphOptions[0]?.id || 'universal-v1');
    const [envInfo, setEnvInfo] = useState<LlmEnvInfo | null>(null);

    const { status: llmStatus } = useLlmHealth(llmProvider); // Use hook

    useEffect(() => {
        const fetchEnv = async () => {
            try {
                const res = await fetch("/api/env");
                const data = await res.json();
                const envLLM = data.llm as LlmEnvInfo;
                setEnvInfo(envLLM);

                // Initialize from Env or LocalStorage
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
                    setSelectedGraphId(storedGraph);
                }

            } catch (e) {
                console.error("Failed to fetch env", e);
            }
        };
        fetchEnv();
    }, []);

    const handleLlmChange = (provider: string) => {
        setLlmProvider(provider);
        window.localStorage.setItem("numezis-llm-selection", JSON.stringify({ provider, model: provider === 'azure' ? envInfo?.azure?.model : envInfo?.lmstudio?.model }));
    };

    const handleGraphChange = (graphId: string) => {
        setSelectedGraphId(graphId);
        window.localStorage.setItem("numezis-graph-selection", graphId);
    };

    const llmOptions = [
        {
            id: 'azure',
            label: 'Azure OpenAI',
            sub: envInfo?.azure?.model || 'Not configured'
        },
        {
            id: 'lmstudio',
            label: 'LM Studio',
            sub: envInfo?.lmstudio?.model || 'Not configured'
        }
    ];

    const graphSelectOptions = graphOptions.map(g => ({
        id: g.id,
        label: g.name,
        sub: g.description
    }));

    // Auto-scroll ref
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    const checkIsAtBottom = () => {
        if (!scrollContainerRef.current) return true;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        // Tolerance of 50px
        return scrollHeight - scrollTop - clientHeight < 50;
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        isAtBottomRef.current = checkIsAtBottom();
    };

    const loadData = async () => {
        try {
            // Load messages
            const res = await fetch(`/api/agent/${conversationId}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }

            // Load pending edits
            const editsRes = await fetch(`/api/agent/edits?conversationId=${conversationId}`);
            if (editsRes.ok) {
                const edits = await editsRes.json();
                setPendingEdits(edits);
            }
        } catch (e) {
            console.error("Failed to load session data", e);
        }
    };

    useEffect(() => {
        void loadData();
        const interval = setInterval(loadData, 3000); // Poll for updates
        return () => clearInterval(interval);
    }, [conversationId]);

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
        }
    };

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        const msg = input;
        setInput('');
        setSending(true);
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

        try {
            const res = await fetch(`/api/agent/${conversationId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    graphId: selectedGraphId,
                    llmProvider
                }),
                signal: controller.signal
            });

            if (!res.ok) throw new Error("Failed to send");

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error("No reader");

            let buffer = '';

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
                        if (dataStr === '[DONE]') break;

                        try {
                            const event = JSON.parse(dataStr);

                            // If it's the user message echoing back, replace the optimistic one
                            // Or generally, just merge into messages
                            setMessages(prev => {
                                // If we have the optimistic message, and this is the user message (same content), replace it
                                if (event.role === 'user' && event.content === msg) {
                                    return prev.map(m => m.id === tempId ? event : m);
                                }
                                // Otherwise append if not exists
                                if (prev.some(m => m.id === event.id)) return prev;
                                return [...prev, event];
                            });

                        } catch (e) {
                            console.error("Failed to parse SSE event", e);
                        }
                    }
                }
            }

            // Final sync to be sure
            await loadData();
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.log("Request aborted by user");
            } else {
                console.error(e);
                // Keep the input if it failed?
            }
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
                    body: JSON.stringify({ conversationId, userMessage: msg })
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

    return (
        <div className="flex flex-col h-full bg-bg-surface">
            {/* Messages Area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-2 scrollbar-elegant"
            >
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
                                ? 'shadow-sm border bg-zinc-800 border-zinc-700 text-zinc-100 max-w-[90%]' // Darker user bubble for contrast
                                : 'bg-transparent pl-0 pt-0 w-full' // Assistant "bubble" is cleaner/transparent
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

                                <div className={`text-[12px] break-words ${isUser ? 'text-zinc-200' : 'text-zinc-300'}`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            pre: ({ children }: any) => <>{children}</>,
                                            p: ({ children }: any) => <p className="mb-0.5 last:mb-0 leading-[1.35] min-h-[1em] text-zinc-300">{children}</p>,
                                            ul: ({ children }: any) => <ul className="list-disc pl-3.5 mb-0.5 space-y-0 marker:text-zinc-500">{children}</ul>,
                                            ol: ({ children }: any) => <ol className="list-decimal pl-3.5 mb-0.5 space-y-0 marker:text-zinc-500">{children}</ol>,
                                            li: ({ children }: any) => <li className="pl-0.5 whitespace-normal leading-[1.35]">{children}</li>,
                                            h1: ({ children }: any) => <h1 className="font-bold text-sm text-zinc-100 mt-1.5 mb-0.5">{children}</h1>,
                                            h2: ({ children }: any) => <h2 className="font-semibold text-sm text-zinc-100 mt-1.5 mb-0.5">{children}</h2>,
                                            h3: ({ children }: any) => <h3 className="font-medium text-[13px] text-zinc-100 mt-1 mb-0.5">{children}</h3>,
                                            h4: ({ children }: any) => <h4 className="font-medium text-[12px] text-zinc-100 mt-1 mb-0.5">{children}</h4>,
                                            a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{children}</a>,
                                            blockquote: ({ children }: any) => <blockquote className="border-l-2 border-zinc-700 pl-2 italic text-zinc-400 my-0.5">{children}</blockquote>,
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
                                        <span className="text-[9px] text-zinc-600 font-mono">{formatTime(m.timestamp)}</span>
                                        <CopyButton content={m.content} />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Cursor-Style Changes Review Panel */}
                {pendingEdits.length > 0 && (
                    <div className="mt-4 mx-2 bg-zinc-900/90 border border-amber-500/40 rounded-lg shadow-xl overflow-hidden">
                        {/* Header with Batch Actions */}
                        <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/50 border-b border-zinc-800">
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
                                    className="py-1 px-2.5 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-800 rounded text-[10px] font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                                >
                                    {rejectingAll ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                                    Reject All
                                </button>
                            </div>
                        </div>

                        {/* File List */}
                        <div className="divide-y divide-zinc-800/50">
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
                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/30 transition-colors text-left"
                                        >
                                            <ChevronRight
                                                size={12}
                                                className={`text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                            />
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isCreate ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-amber-900/30 text-amber-400 border border-amber-800/50'}`}>
                                                {isCreate ? 'NEW' : 'EDIT'}
                                            </span>
                                            <span className="text-[11px] font-mono text-zinc-300 truncate flex-1">
                                                {fileName}
                                            </span>
                                            <span className="text-[9px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {formatTime(edit.createdAt)}
                                            </span>
                                        </button>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="px-3 pb-3 pt-1 bg-zinc-950/30">
                                                {/* File Path */}
                                                <div className="text-[9px] font-mono text-zinc-600 mb-2 truncate">
                                                    {filePath}
                                                </div>

                                                {/* Content Preview */}
                                                {content && (
                                                    <div className="bg-zinc-900 border border-zinc-800 rounded p-2 mb-2 overflow-hidden">
                                                        <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-elegant">
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
                                                        className="flex-1 py-1.5 px-3 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-800 rounded flex items-center justify-center gap-1.5 transition-all text-[10px] font-medium"
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
                        <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                        <span className="text-[10px] italic text-zinc-600">Agent is thinking...</span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Area - Exact match from workbench page */}
            <div className="sticky bottom-0 bg-bg-surface px-4 py-4 backdrop-blur-md border-t border-border-subtle">
                <div className="mx-auto max-w-4xl">
                    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-3 shadow-lg transition-all focus-within:border-border-strong group">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(event) => {
                                const value = event.target.value;
                                setInput(value);
                                if (value === "/") {
                                    setIsPromptSelectorOpen(true);
                                }
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything (⌘L), @ to mention, / for workflows"
                            rows={1}
                            className="w-full resize-none border-none bg-transparent p-0 text-[13px] font-medium text-text-primary outline-none focus:ring-0 placeholder:text-text-muted/60 scrollbar-elegant"
                            style={{
                                minHeight: '28px',
                                maxHeight: '160px',
                                height: 'auto'
                            }}
                        />

                        <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {/* Prompt selector / Add button */}
                                <button
                                    type="button"
                                    onClick={() => setIsPromptSelectorOpen(true)}
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                                    title="Select prompt (⌘K)"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                </button>

                                {/* Mode Indicator - Clickable to open graph info */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsGraphOpen(true)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                                        title="View Context Graph"
                                    >
                                        <Brain className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAuditOpen(true)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                                        title="View Audit Logs"
                                    >
                                        <Terminal className="h-4 w-4" />
                                    </button>
                                    <Selector
                                        label="GRAPH"
                                        value={selectedGraphId}
                                        options={graphSelectOptions}
                                        onSelect={handleGraphChange}
                                        direction="up"
                                        size="sm"
                                    />
                                    <Selector
                                        label="LLM"
                                        value={llmProvider}
                                        options={llmOptions}
                                        onSelect={handleLlmChange}
                                        direction="up"
                                        size="sm"
                                        status={llmStatus}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Sending action */}

                                {/* Circular action button */}
                                <button
                                    type="button"
                                    onClick={sending ? handleStop : () => void handleSend()}
                                    disabled={!sending && !input.trim()}
                                    className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 ${sending
                                        ? "bg-bg-surface border border-border-strong text-rose-500 scale-110 active:scale-95"
                                        : "bg-text-primary text-bg-surface hover:opacity-90 disabled:opacity-20 disabled:cursor-not-allowed"
                                        }`}
                                >
                                    {sending ? (
                                        <div className="h-2.5 w-2.5 bg-rose-500 rounded-sm animate-pulse" />
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                            <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l7.5 7.5a.75.75 0 11-1.06 1.06l-6.22-6.22V21a.75.75 0 01-1.5 0V4.81l-6.22 6.22a.75.75 0 11-1.06-1.06l7.5-7.5z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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

            {/* Audit Log Modal */}
            <AgentAuditModal
                open={isAuditOpen}
                onClose={() => setIsAuditOpen(false)}
                conversationId={conversationId}
            />
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
            className="ml-2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
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
                className="flex items-center gap-2 w-full text-left py-0.5 hover:bg-zinc-800/30 rounded px-1 -ml-1 transition-colors"
            >
                <div className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                    <ChevronRight size={12} />
                </div>
                <div className="flex items-center gap-2 text-[11px] overflow-hidden">
                    <span className="font-semibold text-zinc-400">{displayName}</span>
                    <span className="text-zinc-600 truncate max-w-[300px] font-mono">{displayArgs}</span>
                </div>
            </button>

            {isOpen && output && (
                <div className="pl-5 mt-0.5 border-l border-zinc-800 ml-1.5 pb-2">
                    <div className="text-[10px] text-zinc-500 mb-1 font-mono bg-zinc-900/50 p-1.5 rounded inline-block max-w-full truncate">
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
