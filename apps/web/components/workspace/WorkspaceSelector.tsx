"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";

interface Workspace {
    id: string;
    name: string;
}

interface Category {
    id: string;
    name: string;
    icon?: string;
    color?: string;
}

interface WorkspaceSelectorProps {
    showCategories?: boolean;
}

export function WorkspaceSelector({ showCategories = false }: WorkspaceSelectorProps) {
    const router = useRouter();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/workspaces')
            .then(res => res.json())
            .then(data => {
                setWorkspaces(data);
                // Set first workspace as default if none selected
                const activeWs = data.find((w: any) => w.isActive);
                setCurrentWorkspace(activeWs?.id || data[0]?.id || null);
            })
            .catch(err => console.error('Error fetching workspaces:', err));
    }, []);

    const handleSelectWorkspace = (workspaceId: string) => {
        // Update URL with workspace ID
        void router.push("/app/agent");
        setCurrentWorkspace(workspaceId);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-subtle text-sm"
            >
                {currentWorkspace && workspaces.find(w => w.id === currentWorkspace)?.name}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isOpen ? "transform rotate-180" : ""}>
                    <path d="M7 13l5 5 5-5z"/>
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 w-64 bg-surface-elevated rounded-lg shadow-lg border border-subtle z-50">
                    {workspaces.map(workspace => (
                        <button
                            key={workspace.id}
                            onClick={() => handleSelectWorkspace(workspace.id)}
                            className={`w-full px-4 py-3 text-left hover:bg-surface flex items-center gap-3 ${currentWorkspace === workspace.id ? 'bg-primary/10' : ''}`}
                        >
                            <span className="text-lg">📁</span>
                            <div>
                                <div className="font-medium">{workspace.name}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
