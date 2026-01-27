
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

    const handleSelect = (id: string, title: string) => {
        setActiveConversationId(id);
        setActiveTitle(title);
    };

    const handleCreate = async (title: string = "New Chat") => {
        try {
            const res = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });
            if (res.ok) {
                const data = await res.json();
                setActiveConversationId(data.id);
                setActiveTitle(data.title);
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

    // Shared New Chat Button
    const NewChatButton = (
        <button
            onClick={() => handleCreate()}
            className="flex items-center gap-1.5 px-2 py-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 rounded text-[11px] font-medium transition-colors"
            title="Start New Chat"
        >
            <Plus className="w-4 h-4" />
        </button>
    );

    // If active conversation, show chat. Otherwise show list.
    if (activeConversationId) {
        return (
            <div className="flex flex-col h-full bg-bg-surface font-sans border-l border-zinc-800">
                <div className="h-8 min-h-[32px] border-b border-zinc-800 flex items-center px-2 justify-between bg-zinc-900/60">
                    <button
                        onClick={() => setActiveConversationId(null)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-100 transition-all px-2 py-0.5 hover:bg-zinc-800 rounded border border-transparent hover:border-zinc-700"
                    >
                        <ArrowLeft className="w-3 h-3" /> Back
                    </button>

                    <div className="flex items-center gap-2">
                        {NewChatButton}
                    </div>
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
            <div className="h-8 min-h-[32px] border-b border-zinc-800 flex items-center px-2 justify-end bg-zinc-900/60">
                {NewChatButton}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <ConversationList
                    onSelect={handleSelect}
                    onNew={() => handleCreate()}
                />
            </div>
        </div>
    );
};
