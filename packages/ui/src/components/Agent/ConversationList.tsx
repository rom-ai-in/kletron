
import React, { useEffect, useState } from 'react';
import { Plus, MessageSquare, Archive, Loader2, ChevronRight, ChevronDown, Clock, AlertCircle, PlayCircle, StopCircle, CheckCircle2, Trash2, Pencil } from 'lucide-react';

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

export interface ConversationListProps {
    onSelect: (id: string, title: string) => void;
    currentId?: string;
    onNew: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({ onSelect, currentId, onNew }) => {
    const [conversations, setConversations] = useState<ConversationMetadata[]>([]);
    const [pendingEditCounts, setPendingEditCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch conversations
            const res = await fetch('/api/sessions?limit=50');
            const convs = await res.json();

            setConversations(Array.isArray(convs) ? convs.map((s: any) => ({
                id: s._id || s.id,
                title: s.title || 'Untitled',
                updatedAt: s.updatedAt || s.startedAt,
                status: s.archived ? 'archived' : 'active',
                lastRole: undefined,
            })) : []);
            setPendingEditCounts({});

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
            await fetch(`/api/sessions/${id}?action=delete`, { method: 'DELETE' });
            void fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleArchive = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        // if (!confirm("Archive this conversation?")) return;
        try {
            await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
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
            return { label: 'Waiting', color: 'text-status-warning-text', bgColor: 'bg-status-warning-bg', borderColor: 'border-status-warning-border', icon: AlertCircle };
        if (conv.lastRole === 'user' || conv.lastRole === 'tool')
            return { label: 'Working', color: 'text-status-success-text', bgColor: 'bg-status-success-bg', borderColor: 'border-status-success-border', icon: PlayCircle };
        return { label: 'Idle', color: 'text-text-muted', bgColor: 'bg-text-muted/10', borderColor: 'border-border-subtle', icon: CheckCircle2 };
    };

    const activeConvs = conversations.filter(c => c.status !== 'archived');
    const archivedConvs = conversations.filter(c => c.status === 'archived');

    const handleTitleEdit = (e: React.MouseEvent, conv: ConversationMetadata) => {
        e.stopPropagation();
        setEditingId(conv.id);
        setEditingTitle(conv.title);
    };

    const handleTitleSave = async (e: React.FormEvent | React.FocusEvent, convId: string) => {
        e.preventDefault();
        if (!editingTitle.trim()) {
            setEditingId(null);
            return;
        }
        try {
            await fetch(`/api/sessions/${convId}/title`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editingTitle.trim() })
            });
            setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: editingTitle.trim() } : c));
        } catch (e) {
            console.error(e);
        } finally {
            setEditingId(null);
        }
    };

    const ConversationItem = ({ conv }: { conv: ConversationMetadata }) => {
        const status = getStatus(conv);
        const StatusIcon = status.icon;
        const isActive = currentId === conv.id;
        const isEditing = editingId === conv.id;

        return (
            <div
                onClick={() => !isEditing && onSelect(conv.id, conv.title)}
                className={`group flex flex-col p-3 border-b border-border-subtle cursor-pointer transition-all hover:bg-bg-elevated/60 relative ${isActive ? 'bg-status-success-bg border-l-2 border-l-status-success' : ''
                    }`}
            >
                <div className="flex items-start justify-between w-full mb-1.5">
                    {isEditing ? (
                        <form onSubmit={(e) => handleTitleSave(e, conv.id)} className="flex-1 pr-6">
                            <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={(e) => handleTitleSave(e, conv.id)}
                                autoFocus
                                className="w-full bg-bg-elevated border border-border-strong rounded px-2 py-0.5 text-[13px] font-semibold text-text-primary outline-none focus:border-status-success"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </form>
                    ) : (
                        <span
                            className="text-[13px] font-semibold text-text-primary truncate pr-6 leading-tight cursor-text hover:text-status-success-text"
                            onClick={(e) => handleTitleEdit(e, conv)}
                            title="Click to edit"
                        >
                            {conv.title}
                        </span>
                    )}
                    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        {!isEditing && conv.status !== 'archived' && (
                            <button
                                onClick={(e) => handleTitleEdit(e, conv)}
                                className="p-1 hover:bg-state-active rounded border border-border-strong text-text-muted hover:text-text-primary transition-all"
                                title="Edit title"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                        )}
                        {conv.status !== 'archived' ? (
                            <button
                                onClick={(e) => handleArchive(e, conv.id)}
                                className="p-1 hover:bg-state-active rounded border border-border-strong text-text-muted hover:text-text-primary transition-all"
                                title="Archive"
                            >
                                <Archive className="w-3 h-3" />
                            </button>
                        ) : (
                            <button
                                onClick={(e) => handleDelete(e, conv.id)}
                                className="p-1 hover:bg-status-error-bg rounded border border-status-error-border text-status-error-text hover:text-status-error-text transition-all"
                                title="Delete Permanently"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${status.borderColor} ${status.bgColor} ${status.color} text-[10px] font-bold uppercase tracking-wider`}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {status.label}
                    </span>
                    <span className="flex items-center gap-1 text-text-muted text-[10px] font-medium">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDate(conv.updatedAt)}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-bg-surface border-r border-border-subtle">
            {/* List Content */}
            <div className="flex-1 overflow-y-auto scrollbar-elegant">
                {loading && conversations.length === 0 ? (
                    <div className="flex justify-center p-3">
                        <Loader2 className="w-3 h-3 animate-spin text-status-success-text" />
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {activeConvs.map(conv => (
                            <ConversationItem key={conv.id} conv={conv} />
                        ))}

                        {activeConvs.length === 0 && (
                            <div className="p-6 text-[9px] text-text-muted text-center italic">
                                No active conversations.<br />
                                <span className="text-text-muted">Click + to start.</span>
                            </div>
                        )}

                        {/* Archive Section */}
                        {archivedConvs.length > 0 && (
                            <div className="mt-1 border-t border-border-subtle">
                                <button
                                    onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                                    className="w-full flex items-center gap-1.5 p-2 text-[9px] font-bold text-text-muted hover:text-text-primary hover:bg-bg-elevated/40 transition-all border-b border-border-subtle/50"
                                >
                                    {isArchiveOpen ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                    <Archive className="w-2.5 h-2.5" />
                                    Archived ({archivedConvs.length})
                                </button>
                                {isArchiveOpen && (
                                    <div className="bg-bg-app/30">
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

            <div className="p-1.5 border-t border-border-subtle bg-bg-app/40">
                <button
                    onClick={fetchData}
                    className="w-full text-[8px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary py-1.5 hover:bg-bg-elevated/50 rounded transition-all"
                >
                    Refresh
                </button>
            </div>
        </div>
    );
};
