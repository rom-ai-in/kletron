// apps/web/components/cowork/CoworkWorkbench.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { WorkspaceSidebar } from "../workspace/WorkspaceSidebar";
import { WorkspaceCategorySelector } from "../workspace/WorkspaceCategorySelector";
import { CategorySpecificInput } from "../workspace/CategorySpecificInput";
import { ThreadFeed } from "../chat/ThreadFeed";
import { Message } from "../chat/Message";
import { DEFAULT_WORK_CATEGORIES } from "@kletron/shared";
import type { WorkCategory } from "@kletron/shared";
import { normalizeToWorkModeId } from "@kletron/shared/workMode";
import { AnimatePresence, motion } from "framer-motion";

interface CoworkWorkbenchProps {
    workspaceId: string;
    initialCategory?: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    category?: string;
}

export function CoworkWorkbench({ workspaceId, initialCategory = 'code' }: CoworkWorkbenchProps) {
    const [currentCategory, setCurrentCategory] = useState(initialCategory);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load saved category from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(`kletron-category-${workspaceId}`);
        if (saved) {
            const mode = normalizeToWorkModeId(saved);
            if (DEFAULT_WORK_CATEGORIES.some((c) => c.id === mode)) {
                setCurrentCategory(mode);
            }
        }
    }, [workspaceId]);

    // Save category to localStorage
    useEffect(() => {
        localStorage.setItem(`kletron-category-${workspaceId}`, currentCategory);
    }, [currentCategory, workspaceId]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Handle message send
    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim()) return;

        // Add user message
        const userMessage: ChatMessage = {
            role: 'user',
            content,
            timestamp: new Date(),
            category: currentCategory
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            // Call API to process message
            const mode = normalizeToWorkModeId(currentCategory);
            const response = await fetch(`/api/workspaces/${workspaceId}/categories/${mode}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: content })
            });

            if (!response.ok) {
                throw new Error('Failed to process message');
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            if (reader) {
                const decoder = new TextDecoder();
                let assistantContent = '';

                const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: '',
                    timestamp: new Date(),
                    category: currentCategory
                };

                setMessages(prev => [...prev, assistantMessage]);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    assistantContent += chunk;

                    setMessages(prev => prev.map(msg =>
                        msg.role === 'assistant' && msg.timestamp.getTime() === assistantMessage.timestamp.getTime()
                            ? { ...msg, content: assistantContent }
                            : msg
                    ));
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
                category: currentCategory
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, currentCategory]);

    // Handle category switch
    const handleCategorySwitch = useCallback((categoryId: string) => {
        setCurrentCategory(normalizeToWorkModeId(categoryId));
        setMessages([]);
    }, []);

    const currentCategoryConfig = DEFAULT_WORK_CATEGORIES.find(
        (c) => c.id === normalizeToWorkModeId(currentCategory),
    );

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <WorkspaceSidebar
                workspaceId={workspaceId}
                currentCategory={currentCategory}
                onCategorySelect={handleCategorySwitch}
            />

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div
                    className="p-4 border-b border-subtle flex items-center justify-between"
                    style={{
                        backgroundColor: `${currentCategoryConfig?.color || '#6B7280'}10`,
                        borderBottomColor: `${currentCategoryConfig?.color || '#6B7280'}30`
                    }}
                >
                    <div className="flex items-center gap-3">
                        <WorkspaceCategorySelector
                            currentCategory={currentCategory}
                            onSelect={handleCategorySwitch}
                            workspaceId={workspaceId}
                        />
                        <div>
                            <h1 className="text-lg font-semibold text-foreground">
                                {currentCategoryConfig?.name || 'Workbench'}
                            </h1>
                            <p className="text-sm text-subtle">
                                {currentCategoryConfig?.description || ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-subtle">
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>

                {/* Chat area with category transition animation */}
                <div className="flex-1 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentCategory}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="p-4"
                        >
                            <ThreadFeed
                                messages={messages}
                                isLoading={isLoading}
                            />
                            <div ref={messagesEndRef} />
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Category-specific input */}
                <div className="p-4 border-t border-subtle">
                    <CategorySpecificInput
                        category={currentCategory}
                        onSubmit={handleSendMessage}
                    />
                </div>
            </div>
        </div>
    );
}
