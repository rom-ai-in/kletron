'use client';

import React, { useState, useCallback } from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { AddWorkspaceModal } from '../CommandCenter/AddWorkspaceModal';

export interface RequireWorkspaceProps {
    children: React.ReactNode;
    /** Optional custom message */
    message?: string;
}

/**
 * Wrapper component that gates page content behind an active workspace.
 * If no workspace is selected, shows a friendly prompt to select or add one.
 */
export function RequireWorkspace({ children, message }: RequireWorkspaceProps) {
    const { activeWorkspace, workspaces, loading, switchWorkspace, refreshWorkspaces } = useWorkspace();
    const [addOpen, setAddOpen] = useState(false);

    const handleCreated = useCallback(async (ws: { id: string; name: string; rootPath: string }) => {
        // Refresh the workspace list first so the new workspace is in state
        await refreshWorkspaces();
        await switchWorkspace(ws.id);
        setAddOpen(false);
    }, [switchWorkspace, refreshWorkspaces]);

    // While loading, show a minimal spinner
    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-bg-app">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-border-subtle border-t-text-secondary rounded-full animate-spin" />
                    <p className="text-xs text-text-muted">Loading workspace...</p>
                </div>
            </div>
        );
    }

    // If there's an active workspace, render children
    if (activeWorkspace) {
        return <>{children}</>;
    }

    // No active workspace — show prompt
    return (
        <>
            <div className="flex h-full items-center justify-center bg-bg-app">
                <div className="flex flex-col items-center text-center max-w-sm px-6">
                    <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center mb-5">
                        <FolderOpen className="w-8 h-8 text-text-muted" />
                    </div>
                    <h2 className="text-base font-semibold text-text-primary mb-1">
                        Workspace Required
                    </h2>
                    <p className="text-sm text-text-muted mb-6">
                        {message || 'This page requires an active workspace. Select an existing workspace from the header, or add a new one.'}
                    </p>

                    {/* If user has existing workspaces, show quick-select list */}
                    {workspaces.length > 0 && (
                        <div className="w-full mb-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                                Select a workspace
                            </p>
                            {workspaces.map((ws) => (
                                <button
                                    key={ws.id}
                                    onClick={() => void switchWorkspace(ws.id)}
                                    className="w-full flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2.5 text-left hover:bg-state-hover hover:border-border-strong transition-colors"
                                >
                                    <FolderOpen className="w-4 h-4 text-text-muted flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-text-primary truncate">{ws.name}</p>
                                        <p className="text-[11px] text-text-muted truncate">{ws.rootPath}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => setAddOpen(true)}
                        className="flex items-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-bg-surface hover:opacity-90 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Add New Workspace
                    </button>
                </div>
            </div>

            <AddWorkspaceModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                onCreated={handleCreated}
            />
        </>
    );
}
