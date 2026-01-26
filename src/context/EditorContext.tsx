import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { EditorState, AgentId, FileId, CursorState, Position, AgentDiff } from '../types/editor';

interface EditorContextType {
    state: EditorState;
    claimFile: (fileId: FileId, agentId: AgentId) => Promise<void>;
    releaseFile: (fileId: FileId, agentId: AgentId) => Promise<void>;
    updateCursor: (fileId: FileId, agentId: AgentId, position: Position) => Promise<void>;
    submitDiff: (fileId: FileId, agentId: AgentId, chunks: any[]) => Promise<void>; // chunks typed any for now to facilitate call
    commitDiff: (fileId: FileId, agentId: AgentId, diffId: string) => Promise<void>;
    // Helper to get active agents for a file
    getAgentsForFile: (fileId: FileId) => AgentId[];
}

const defaultState: EditorState = {
    openFiles: [],
    fileAgents: {},
    cursors: {},
    pendingDiffs: {},
    alerts: []
};

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<EditorState>(defaultState);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Subscribe to SSE updates
    useEffect(() => {
        const es = new EventSource('/api/editor/state/subscribe');

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'SYNC') {
                    setState(data.payload);
                } else if (data.type === 'PATCH') {
                    setState(prev => ({ ...prev, ...data.payload }));
                }
            } catch (err) {
                console.error('Failed to parse editor state update', err);
            }
        };

        es.onerror = (err) => {
            console.error('SSE Error', err);
            // Optional: Reconnect logic is often handled by browser or simple reload
        };

        eventSourceRef.current = es;

        return () => {
            es.close();
        };
    }, []);

    const claimFile = useCallback(async (fileId: FileId, agentId: AgentId) => {
        await fetch(`/api/editor/agents/${agentId}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId })
        });
    }, []);

    const releaseFile = useCallback(async (fileId: FileId, agentId: AgentId) => {
        await fetch(`/api/editor/agents/${agentId}/release`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId })
        });
    }, []);

    const updateCursor = useCallback(async (fileId: FileId, agentId: AgentId, position: Position) => {
        // Optimistic update could happen here, but for now relying on SSE
        await fetch(`/api/editor/agents/${agentId}/cursor`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, position })
        });
    }, []);

    const submitDiff = useCallback(async (fileId: FileId, agentId: AgentId, chunks: any[]) => {
        await fetch(`/api/editor/agents/${agentId}/diff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, chunks })
        });
    }, []);

    const commitDiff = useCallback(async (fileId: FileId, agentId: AgentId, diffId: string) => {
        await fetch(`/api/editor/agents/${agentId}/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, diffId })
        });
    }, []);

    const getAgentsForFile = useCallback((fileId: FileId) => {
        return state.fileAgents[fileId] || [];
    }, [state.fileAgents]);

    return (
        <EditorContext.Provider value={{
            state,
            claimFile,
            releaseFile,
            updateCursor,
            submitDiff,
            commitDiff,
            getAgentsForFile
        }}>
            {children}
        </EditorContext.Provider>
    );
};

export const useEditorState = () => {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error('useEditorState must be used within an EditorProvider');
    }
    return context;
};
