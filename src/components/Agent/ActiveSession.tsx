import React, { useEffect, useState, useRef } from 'react';
import { Send, Loader2, Play, CheckCircle, XCircle, Clock, Wrench, Brain, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolOutput } from './ToolOutput';
import { ThoughtsPanel } from './ThoughtsPanel';
import { CodeBlock } from './CodeBlock';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: string;
    toolName?: string;
    toolArgs?: string;
    toolOutput?: string;
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
}

export const ActiveSession: React.FC<ActiveSessionProps> = ({ conversationId, title, onApproveEdit }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);

    // Auto-scroll ref
    const bottomRef = useRef<HTMLDivElement>(null);

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
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, pendingEdits]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        const msg = input;
        setInput('');
        setSending(true);

        // Optimistic update
        const optimisticMsg: Message = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: msg,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const res = await fetch(`/api/agent/${conversationId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg })
            });

            if (!res.ok) throw new Error("Failed to send");

            // Reload to get the real response
            await loadData();
        } catch (e) {
            console.error(e);
            alert("Failed to send message: " + (e as any).message);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Cmd+Enter to send
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSend();
        }
    };

    const formatTime = (iso: string) => {
        const date = new Date(iso);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full bg-bg-surface">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-elegant">
                {messages.map((m, i) => {
                    const isUser = m.role === 'user';
                    const isSystem = m.role === 'system';
                    const isTool = m.role === 'tool';
                    const isAssistant = m.role === 'assistant';

                    if (isSystem) return null;

                    // TOOL MESSAGE (Output)
                    if (isTool) {
                        return (
                            <div key={m.id || i} className="pl-2 border-l-2 border-purple-500/20 ml-2">
                                <ToolOutput output={m.content || m.toolOutput || ''} />
                            </div>
                        );
                    }

                    // ASSISTANT / USER MESSAGE
                    return (
                        <div key={m.id || i} className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>

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
                            <div className={`relative max-w-[90%] rounded-lg shadow-sm border px-3 py-2 ${isUser
                                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100' // Darker user bubble for contrast
                                    : 'bg-transparent border-transparent pl-0 pt-0' // Assistant "bubble" is cleaner/transparent
                                }`}>

                                {/* Tool Call Indicator (If assistant triggered a tool) */}
                                {m.toolName && (
                                    <div className="mb-2 inline-flex items-center gap-2 px-2 py-1 bg-purple-500/10 border border-purple-500/30 rounded text-[10px] text-purple-300 font-mono">
                                        <Wrench size={10} />
                                        <span className="font-semibold">Used: {m.toolName}</span>
                                        {m.toolArgs && <span className="opacity-50 truncate max-w-[150px]">{m.toolArgs}</span>}
                                    </div>
                                )}

                                <div className={`prose prose-invert prose-p:leading-relaxed prose-pre:m-0 max-w-none text-[12px] ${isUser ? 'text-zinc-200' : 'text-zinc-300'}`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
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

                                {/* Timestamp Footer */}
                                <div className={`mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    <span className="text-[9px] text-zinc-600 font-mono">{formatTime(m.timestamp)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Pending Edits Block */}
                {pendingEdits.length > 0 && (
                    <div className="mt-4 mx-2 p-3 bg-zinc-900/80 border border-amber-500/30 rounded-lg shadow-lg">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Approval Required</span>
                        </div>
                        <div className="space-y-3">
                            {pendingEdits.map(edit => (
                                <div key={edit.id} className="relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-900">
                                            {edit.toolName}
                                        </span>
                                        <span className="text-[9px] text-zinc-500">{formatTime(edit.createdAt)}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-300 mb-2 pl-1 leading-relaxed">
                                        {edit.description || "Proposed file modifications..."}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => onApproveEdit(edit.id)}
                                            className="flex-1 py-1.5 px-3 bg-zinc-800 hover:bg-green-900/30 text-zinc-400 hover:text-green-400 border border-zinc-700 hover:border-green-800 rounded flex items-center justify-center gap-2 transition-all text-[10px] font-medium"
                                        >
                                            <CheckCircle size={12} /> Approve Change
                                        </button>
                                        <button className="flex-1 py-1.5 px-3 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-800 rounded flex items-center justify-center gap-2 transition-all text-[10px] font-medium">
                                            <XCircle size={12} /> Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
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

            {/* Input Area */}
            <div className="p-3 bg-zinc-900 border-t border-zinc-800">
                <div className="relative bg-zinc-950 border border-zinc-800 rounded-lg focus-within:ring-1 focus-within:ring-zinc-700 transition-all shadow-inner">
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask the agent..."
                        className="w-full bg-transparent border-none rounded-lg px-3 py-2 text-[11px] text-zinc-200 placeholder-zinc-600 focus:ring-0 resize-none h-14 scrollbar-elegant leading-relaxed"
                    />
                    <div className="absolute bottom-1.5 right-2 flex items-center gap-2">
                        <span className="text-[9px] text-zinc-600 font-mono hidden group-focus-within:inline-block">
                            ⌘ + ⏎ to send
                        </span>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || sending}
                            className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
                        >
                            <Send size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
