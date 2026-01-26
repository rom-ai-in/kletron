
import React, { useState } from 'react';
import { ConversationList } from './ConversationList';
import { ActiveSession } from './ActiveSession';
import { Plus, MessageSquare, ArrowLeft } from 'lucide-react';

interface AgentPanelProps {
    onClose?: () => void; // Optional now
}

export const AgentPanel: React.FC<AgentPanelProps> = () => {
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [activeTitle, setActiveTitle] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newTopic, setNewTopic] = useState('');

    const handleSelect = (id: string, title: string) => {
        setActiveConversationId(id);
        setActiveTitle(title);
    };

    const handleCreate = async () => {
        if (!newTopic.trim()) return;
        try {
            const res = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTopic })
            });
            if (res.ok) {
                const data = await res.json();
                setActiveConversationId(data.id);
                setActiveTitle(data.title);
                setIsCreating(false);
                setNewTopic('');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleApproveEdit = async (editId: string) => {
        try {
            await fetch('/api/agent/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ editId })
            });
        } catch (e) {
            console.error(e);
            alert("Failed to approve edit");
        }
    };

    // If active conversation, show chat. Otherwise show list.
    if (activeConversationId) {
        return (
            <div className="flex flex-col h-full bg-bg-surface font-sans border-l border-zinc-800">
                <div className="h-8 min-h-[32px] border-b border-zinc-800 flex items-center px-2 justify-between bg-zinc-900/60">
                    <button
                        onClick={() => setActiveConversationId(null)}
                        className="flex items-center gap-1 text-[9px] font-semibold text-zinc-400 hover:text-zinc-100 transition-all px-1.5 py-0.5 hover:bg-zinc-800 rounded border border-transparent hover:border-zinc-700"
                    >
                        <ArrowLeft className="w-2.5 h-2.5" /> Back
                    </button>
                    <span className="text-[9px] font-bold text-zinc-100 truncate max-w-[200px]" title={activeTitle}>
                        {activeTitle}
                    </span>
                </div>
                <div className="flex-1 overflow-hidden">
                    <ActiveSession
                        conversationId={activeConversationId}
                        title={activeTitle}
                        onApproveEdit={handleApproveEdit}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-bg-surface font-sans border-l border-zinc-800">
            {/* Header */}
            <div className="h-8 min-h-[32px] border-b border-zinc-800 flex items-center px-2 justify-between bg-zinc-900/60">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">AI Agent</span>
                <button
                    onClick={() => {
                        setActiveConversationId(null);
                        setIsCreating(true);
                    }}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-all border border-transparent hover:border-zinc-600"
                    title="New Chat"
                >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {isCreating ? (
                    <div className="p-2 bg-zinc-900/30">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block">New Conversation</label>
                        <input
                            autoFocus
                            type="text"
                            value={newTopic}
                            onChange={e => setNewTopic(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-[10px] text-zinc-100 mb-2 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 focus:outline-none placeholder-zinc-600 transition-all"
                            placeholder="Describe your task..."
                        />
                        <div className="flex justify-end gap-1.5">
                            <button
                                onClick={() => setIsCreating(false)}
                                className="px-2 py-1 text-[9px] font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded border border-zinc-700 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!newTopic.trim()}
                                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-[9px] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-sky-500/30"
                            >
                                Start
                            </button>
                        </div>
                    </div>
                ) : (
                    <ConversationList
                        onSelect={handleSelect}
                        onNew={() => setIsCreating(true)}
                    />
                )}
            </div>
        </div>
    );
};
