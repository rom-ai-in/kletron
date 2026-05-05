// apps/web/context/CoworkContext.tsx
"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { DEFAULT_WORK_CATEGORIES } from "@kletron/shared";
import type { WorkCategory } from "@kletron/shared";
import { normalizeToWorkModeId } from "@kletron/shared/workMode";

export interface CoworkState {
    // Current state
    currentCategory: string;
    currentWorkspace: string | null;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
        category?: string;
    }>;
    isLoading: boolean;
    isConnected: boolean;

    // Category management
    categories: WorkCategory[];
    availableCategories: WorkCategory[];

    // Context preservation
    contextPreserved: boolean;
    lastCategorySwitch: Date | null;
    preservedFrom: string | null;

    // Actions
    setCurrentCategory: (categoryId: string) => void;
    switchCategory: (categoryId: string, preserveContext?: boolean) => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    clearMessages: () => void;
    setWorkspace: (workspaceId: string) => void;
    restoreContext: () => Promise<void>;
}

const CoworkContext = createContext<CoworkState | null>(null);

export function useCowork() {
    const context = useContext(CoworkContext);
    if (!context) {
        throw new Error('useCowork must be used within a CoworkProvider');
    }
    return context;
}

interface CoworkProviderProps {
    children: ReactNode;
    workspaceId: string;
}

export function CoworkProvider({ children, workspaceId }: CoworkProviderProps) {
    const [currentCategory, setCurrentCategoryState] = useState('code');
    const [currentWorkspace, setWorkspaceState] = useState<string | null>(workspaceId);
    const [messages, setMessages] = useState<CoworkState['messages']>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [contextPreserved, setContextPreserved] = useState(false);
    const [lastCategorySwitch, setLastCategorySwitch] = useState<Date | null>(null);
    const [preservedFrom, setPreservedFrom] = useState<string | null>(null);

    // Load saved state
    useEffect(() => {
        const saved = localStorage.getItem(`kletron-category-${workspaceId}`);
        if (saved) {
            const mode = normalizeToWorkModeId(saved);
            if (DEFAULT_WORK_CATEGORIES.some((c) => c.id === mode)) {
                setCurrentCategoryState(mode);
            }
        }

        // Check connection status
        const checkConnection = async () => {
            try {
                const response = await fetch(`/api/workspaces/${workspaceId}/status`);
                setIsConnected(response.ok);
            } catch {
                setIsConnected(false);
            }
        };

        void checkConnection();
        const interval = setInterval(() => {
            void checkConnection();
        }, 30000);
        return () => clearInterval(interval);
    }, [workspaceId]);

    // Save category to localStorage
    useEffect(() => {
        localStorage.setItem(`kletron-category-${workspaceId}`, currentCategory);
    }, [currentCategory, workspaceId]);

    const setCurrentCategory = useCallback((categoryId: string) => {
        setCurrentCategoryState(normalizeToWorkModeId(categoryId));
    }, []);

    const switchCategory = useCallback(async (categoryId: string, preserveContext: boolean = true) => {
        const fromCategory = currentCategory;
        const toCategory = normalizeToWorkModeId(categoryId);

        if (preserveContext) {
            try {
                // Save context before switching
                const response = await fetch(`/api/workspaces/${workspaceId}/context/preserve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fromCategory,
                        toCategory
                    })
                });

                if (response.ok) {
                    setContextPreserved(true);
                    setLastCategorySwitch(new Date());
                    setPreservedFrom(fromCategory);
                }
            } catch (error) {
                console.error('Failed to preserve context:', error);
            }
        }

        setCurrentCategoryState(toCategory);
        // Clear messages for fresh start in new category
        setMessages([]);
    }, [currentCategory, workspaceId]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: CoworkState['messages'][number] = {
            role: 'user',
            content,
            timestamp: new Date(),
            category: currentCategory
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const mode = normalizeToWorkModeId(currentCategory);
            const response = await fetch(`/api/workspaces/${workspaceId}/categories/${mode}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: content })
            });

            if (!response.ok) {
                throw new Error('Failed to process message');
            }

            // Handle streaming
            const reader = response.body?.getReader();
            if (reader) {
                const decoder = new TextDecoder();
                let assistantContent = '';

                const assistantMessage: CoworkState['messages'][number] = {
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
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
                category: currentCategory
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, currentCategory, isLoading]);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    const setWorkspace = useCallback((workspaceId: string) => {
        setWorkspaceState(workspaceId);
    }, []);

    const restoreContext = useCallback(async () => {
        if (!preservedFrom) return;

        try {
            const response = await fetch(`/api/workspaces/${workspaceId}/context/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromCategory: preservedFrom,
                    toCategory: currentCategory
                })
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(data.messages || []);
                setContextPreserved(false);
                setPreservedFrom(null);
            }
        } catch (error) {
            console.error('Failed to restore context:', error);
        }
    }, [workspaceId, preservedFrom, currentCategory]);

    const value: CoworkState = {
        currentCategory,
        currentWorkspace,
        messages,
        isLoading,
        isConnected,
        categories: DEFAULT_WORK_CATEGORIES,
        availableCategories: DEFAULT_WORK_CATEGORIES,
        contextPreserved,
        lastCategorySwitch,
        preservedFrom,
        setCurrentCategory,
        switchCategory,
        sendMessage,
        clearMessages,
        setWorkspace,
        restoreContext
    };

    return (
        <CoworkContext.Provider value={value}>
            {children}
        </CoworkContext.Provider>
    );
}
