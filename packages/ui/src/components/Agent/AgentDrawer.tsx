
import React, { useState } from 'react';
import { ConversationList } from './ConversationList';
import { ActiveSession } from './ActiveSession';
import { X } from 'lucide-react';

interface AgentDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AgentDrawer: React.FC<AgentDrawerProps> = ({ isOpen, onClose }) => {
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
            // The polling in ActiveSession will pick up state changes or fetch will happen
            // Ideally we'd trigger a reload but polling handles it for now
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 left-0 w-[800px] bg-bg-app border-r border-border-subtle shadow-2xl z-50 flex overflow-hidden">
            {/* Collapsible Sidebar for Conversations */}
            <div className="w-64 flex-shrink-0 h-full">
                <ConversationList
                    onSelect={handleSelect}
                    currentId={activeConversationId || undefined}
                    onNew={() => {
                        setActiveConversationId(null);
                        setIsCreating(true);
                    }}
                />
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col h-full bg-bg-app relative">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 text-text-muted hover:text-text-primary z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {!activeConversationId && !isCreating && (
                    <div className="flex-1 flex flex-col items-center justify-center text-text-muted p-8 text-center">
                        <div className="w-16 h-16 bg-bg-surface rounded-full flex items-center justify-center mb-4 border border-border-subtle">
                            <span className="text-2xl">🤖</span>
                        </div>
                        <h3 className="text-lg font-medium text-text-primary mb-2">Agent Developer</h3>
                        <p className="text-sm max-w-xs">
                            Launch a ReAct agent to help you coding. It can analyze files, propose edits, and run commands safely.
                        </p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="mt-6 px-4 py-2 bg-primary-main hover:bg-primary-hover text-white rounded-md text-sm font-medium transition-colors"
                        >
                            Start New Session
                        </button>
                    </div>
                )}

                {isCreating && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <h3 className="text-lg font-medium text-text-primary mb-4">Start New Task</h3>
                        <div className="w-full max-w-md">
                            <label className="text-xs text-text-subtle mb-1 block">What should the agent do?</label>
                            <input
                                autoFocus
                                type="text"
                                value={newTopic}
                                onChange={e => setNewTopic(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                placeholder="E.g., Refactor the auth module..."
                                className="w-full bg-bg-surface border border-border-input rounded px-3 py-2 text-sm text-text-primary mb-4 focus:ring-1 focus:ring-primary-main focus:border-primary-main"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setIsCreating(false)}
                                    className="px-3 py-1 text-text-muted hover:text-text-primary text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!newTopic.trim()}
                                    className="px-4 py-1.5 bg-primary-main hover:bg-primary-hover text-white rounded text-sm disabled:opacity-50"
                                >
                                    Launch
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeConversationId && (
                    <ActiveSession
                        conversationId={activeConversationId}
                        title={activeTitle}
                        onApproveEdit={handleApproveEdit}
                        onApproveAll={handleApproveAll}
                        onRejectEdit={handleRejectEdit}
                        onRejectAll={handleRejectAll}
                    />
                )}
            </div>
        </div>
    );
};
