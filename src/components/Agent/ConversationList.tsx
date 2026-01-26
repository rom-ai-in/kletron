
import React, { useEffect, useState } from 'react';
import { Plus, MessageSquare, Archive, Loader2, ChevronRight, ChevronDown, Clock, AlertCircle, PlayCircle, StopCircle, CheckCircle2, Trash2 } from 'lucide-react';

interface ConversationMetadata {
    id: string;
    title: string;
    updatedAt: string;
    status: 'active' | 'archived';
    lastRole?: 'user' | 'assistant' | 'system' | 'tool';
}

interface PendingEdit {
    conversationId: string;
}

interface ConversationListProps {
    onSelect: (id: string, title: string) => void;
    currentId?: string;
    onNew: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({ onSelect, currentId, onNew }) => {
    const [conversations, setConversations] = useState<ConversationMetadata[]>([]);
    const [pendingEditCounts, setPendingEditCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch conversations
            const res = await fetch('/api/agent');
            const convs = await res.json();

            // Fetch pending edits to determine "Waiting" status
            const editsRes = await fetch('/api/agent/edits');
            const edits: PendingEdit[] = await editsRes.json();
            const counts: Record<string, number> = {};
            edits.forEach(e => {
                counts[e.conversationId] = (counts[e.conversationId] || 0) + 1;
            });

            setConversations(convs);
            setPendingEditCounts(counts);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchData();
    }, []);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Permanently delete this conversation? This cannot be undone.")) return;
        try {
            await fetch(`/api/agent?id=${id}&permanent=true`, { method: 'DELETE' });
            void fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleArchive = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Archive this conversation?")) return;
        try {
            await fetch(`/api/agent?id=${id}`, { method: 'DELETE' });
            void fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    // Helper to format date
    const formatDate = (iso: string) => {
        const date = new Date(iso);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();

        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const getStatus = (conv: ConversationMetadata) => {
        if (pendingEditCounts[conv.id])
            return { label: 'Waiting', color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/40', icon: AlertCircle };
        if (conv.lastRole === 'user' || conv.lastRole === 'tool')
            return { label: 'Working', color: 'text-sky-400', bgColor: 'bg-sky-500/20', borderColor: 'border-sky-500/40', icon: PlayCircle };
        return { label: 'Idle', color: 'text-zinc-500', bgColor: 'bg-zinc-700/20', borderColor: 'border-zinc-700/40', icon: CheckCircle2 };
    };

    const activeConvs = conversations.filter(c => c.status !== 'archived');
    const archivedConvs = conversations.filter(c => c.status === 'archived');

    const ConversationItem = ({ conv }: { conv: ConversationMetadata }) => {
        const status = getStatus(conv);
        const StatusIcon = status.icon;
        const isActive = currentId === conv.id;

        return (
            <div
                onClick={() => onSelect(conv.id, conv.title)}
                className={`group flex flex-col p-3 border-b border-zinc-800 cursor-pointer transition-all hover:bg-zinc-800/60 relative ${isActive ? 'bg-sky-500/10 border-l-2 border-l-sky-500' : ''
                    }`}
            >
                <div className="flex items-start justify-between w-full mb-1.5">
                    <span className="text-[13px] font-semibold text-zinc-100 truncate pr-6 leading-tight">{conv.title}</span>
                    {conv.status !== 'archived' ? (
                        <button
                            onClick={(e) => handleArchive(e, conv.id)}
                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded border border-zinc-600 text-zinc-400 hover:text-zinc-200 transition-all"
                            title="Archive"
                        >
                            <Archive className="w-3 h-3" />
                        </button>
                    ) : (
                        <button
                            onClick={(e) => handleDelete(e, conv.id)}
                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/40 rounded border border-red-900/50 text-red-500 hover:text-red-400 transition-all"
                            title="Delete Permanently"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
                <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${status.borderColor} ${status.bgColor} ${status.color} text-[10px] font-bold uppercase tracking-wider`}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {status.label}
                    </span>
                    <span className="flex items-center gap-1 text-zinc-500 text-[10px] font-medium">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDate(conv.updatedAt)}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-bg-surface border-r border-zinc-800">
            {/* List Content */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant">
                {loading && conversations.length === 0 ? (
                    <div className="flex justify-center p-3">
                        <Loader2 className="w-3 h-3 animate-spin text-sky-500" />
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {activeConvs.map(conv => (
                            <ConversationItem key={conv.id} conv={conv} />
                        ))}

                        {activeConvs.length === 0 && (
                            <div className="p-6 text-[9px] text-zinc-500 text-center italic">
                                No active conversations.<br />
                                <span className="text-zinc-600">Click + to start.</span>
                            </div>
                        )}

                        {/* Archive Section */}
                        {archivedConvs.length > 0 && (
                            <div className="mt-1 border-t border-zinc-800">
                                <button
                                    onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                                    className="w-full flex items-center gap-1.5 p-2 text-[9px] font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-all border-b border-zinc-800/50"
                                >
                                    {isArchiveOpen ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                    <Archive className="w-2.5 h-2.5" />
                                    Archived ({archivedConvs.length})
                                </button>
                                {isArchiveOpen && (
                                    <div className="bg-zinc-900/30">
                                        {archivedConvs.map(conv => (
                                            <ConversationItem key={conv.id} conv={conv} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-1.5 border-t border-zinc-800 bg-zinc-900/40">
                <button
                    onClick={fetchData}
                    className="w-full text-[8px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-200 py-1.5 hover:bg-zinc-800/50 rounded transition-all"
                >
                    Refresh
                </button>
            </div>
        </div>
    );
};
