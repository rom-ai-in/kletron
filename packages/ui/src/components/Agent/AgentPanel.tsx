
import React, { useState } from 'react';
import { ConversationList } from './ConversationList';
import { ActiveSession } from './ActiveSession';
import { Plus, MessageSquare, ArrowLeft } from 'lucide-react';

export interface AgentPanelProps {
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

    const handleApproveAll = async () => {
        if (!activeConversationId) return;
        try {
            await fetch('/api/agent/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: activeConversationId, action: 'all' })
            });
        } catch (e) {
            console.error(e);
            alert("Failed to approve all edits");
        }
    };

    const handleRejectEdit = async (editId: string) => {
        try {
            await fetch('/api/agent/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ editId })
            });
        } catch (e) {
            console.error(e);
            alert("Failed to reject edit");
        }
    };

    const handleRejectAll = async () => {
        if (!activeConversationId) return;
        try {
            await fetch('/api/agent/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: activeConversationId, action: 'all' })
            });
        } catch (e) {
            console.error(e);
            alert("Failed to reject all edits");
        }
    };

    // Shared New Chat Button
    const NewChatButton = (
        <button
            onClick={() => handleCreate()}
            className="flex items-center gap-1.5 px-2 py-1 hover:bg-bg-elevated text-text-muted hover:text-text-primary rounded text-[11px] font-medium transition-colors"
            title="Start New Chat"
        >
            <Plus className="w-4 h-4" />
        </button>
    );

    // If active conversation, show chat. Otherwise show list.
    if (activeConversationId) {
        return (
            <div className="flex flex-col h-full bg-bg-surface font-sans border-l border-border-subtle">
                <div className="h-8 min-h-[32px] border-b border-border-subtle flex items-center px-2 justify-between bg-bg-app/60">
                    <button
                        onClick={() => setActiveConversationId(null)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-text-muted hover:text-text-primary transition-all px-2 py-0.5 hover:bg-bg-elevated rounded border border-transparent hover:border-border-subtle"
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
                        onApproveAll={handleApproveAll}
                        onRejectEdit={handleRejectEdit}
                        onRejectAll={handleRejectAll}
                        onTitleChange={(newTitle) => setActiveTitle(newTitle)}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-bg-surface font-sans border-l border-border-subtle">
            {/* Header */}
            <div className="h-8 min-h-[32px] border-b border-border-subtle flex items-center px-2 justify-end bg-bg-app/60">
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
