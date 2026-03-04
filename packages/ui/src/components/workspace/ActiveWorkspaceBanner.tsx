'use client';

import React from 'react';
import { Folder } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export interface ActiveWorkspaceBannerProps {
    className?: string;
}

/**
 * Compact banner displaying the active workspace name and path.
 * Used below page headers on workspace-scoped pages for clarity.
 */
export function ActiveWorkspaceBanner({ className = '' }: ActiveWorkspaceBannerProps) {
    const { activeWorkspace } = useWorkspace();

    if (!activeWorkspace) return null;

    return (
        <div className={`flex items-center gap-2 px-6 py-1.5 border-b border-border-subtle bg-bg-surface/50 ${className}`}>
            <Folder className="h-3 w-3 text-text-muted flex-shrink-0" />
            <span className="text-[11px] font-medium text-text-secondary truncate">
                {activeWorkspace.name}
            </span>
            <span className="text-[10px] text-text-muted truncate hidden sm:inline">
                {activeWorkspace.rootPath}
            </span>
        </div>
    );
}
