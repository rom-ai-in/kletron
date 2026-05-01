import React from 'react';
import { WorkCategory } from '@kletron/agent-core';

interface WorkspaceSidebarProps {
    workspaceId: string;
    currentCategory: string;
    onCategorySelect: (categoryId: string) => void;
}

export const WorkspaceSidebar = ({
    workspaceId,
    currentCategory,
    onCategorySelect
}: WorkspaceSidebarProps) => {
    // In production, these would come from the API
    const categories: WorkCategory[] = [
        {
            id: 'coding',
            name: 'Code Assistance',
            description: 'AI-powered code analysis and generation',
            icon: '💻',
            color: '#3B82F6'
        },
        {
            id: 'drafting',
            name: 'Document Drafting',
            description: 'Create professional documents',
            icon: '✏️',
            color: '#10B981'
        },
        {
            id: 'automation',
            name: 'Workflow Automation',
            description: 'Automate repetitive tasks',
            icon: '⚡',
            color: '#F59E0B'
        },
        {
            id: 'general',
            name: 'General Assistance',
            description: 'Open-ended questions and help',
            icon: '🎯',
            color: '#6B7280'
        }
    ];

    return (
        <div className="w-64 h-full bg-surface border-r border-subtle flex flex-col">
            {/* Workspace header */}
            <div className="p-4 border-b border-subtle">
                <h2 className="font-semibold text-lg text-foreground">Workspace</h2>
                <p className="text-sm text-subtle truncate" title={workspaceId}>
                    {workspaceId}
                </p>
            </div>

            {/* Categories section */}
            <div className="p-4 border-b border-subtle">
                <h3 className="text-sm font-medium text-subtle uppercase tracking-wider mb-3">Categories</h3>
                <nav className="space-y-1">
                    {categories.map(category => (
                        <button
                            key={category.id}
                            onClick={() => onCategorySelect(category.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${currentCategory === category.id ? 'bg-primary/10 font-medium' : 'hover:bg-surface'}`}
                        >
                            <span className="text-xl" style={{ color: category.color }}>
                                {category.icon}
                            </span>
                            <div>
                                <div className="font-medium text-foreground">
                                    {category.name}
                                </div>
                                <div className="text-xs text-subtle">
                                    {category.description}
                                </div>
                            </div>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Category-specific content */}
            <div className="flex-1 overflow-y-auto p-4">
                {currentCategory === 'coding' && (
                    <CodingCategoryContent workspaceId={workspaceId} />
                )}
                {currentCategory === 'drafting' && (
                    <DraftingCategoryContent workspaceId={workspaceId} />
                )}
                {currentCategory === 'automation' && (
                    <AutomationCategoryContent workspaceId={workspaceId} />
                )}
                {currentCategory === 'general' && (
                    <GeneralCategoryContent workspaceId={workspaceId} />
                )}
            </div>
        </div>
    );
};

const CodingCategoryContent = ({ workspaceId }: { workspaceId: string }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-subtle uppercase tracking-wider">Code Tools</h3>
            <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
                    <span>📁</span>
                    <span>File Explorer</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
                    <span>🔍</span>
                    <span>Search Code</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
                    <span>⚙️</span>
                    <span>Configuration</span>
                </div>
            </div>
        </div>
    );
};

const DraftingCategoryContent = ({ workspaceId }: { workspaceId: string }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-subtle uppercase tracking-wider">Drafting Tools</h3>
            <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
                    <span>📄</span>
                    <span>Document Templates</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
                    <span>🎨</span>
                    <span>Formatting Options</span>
                </div>
            </div>
        </div>
    );
};

const AutomationCategoryContent = ({ workspaceId }: { workspaceId: string }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-subtle uppercase tracking-wider">Automation Tools</h3>
            <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
                    <span>⏰</span>
                    <span>Schedules</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
                    <span>🔗</span>
                    <span>Connectors</span>
                </div>
            </div>
        </div>
    );
};

const GeneralCategoryContent = ({ workspaceId }: { workspaceId: string }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-subtle uppercase tracking-wider">General Tools</h3>
            <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer">
                    <span>🔍</span>
                    <span>Web Search</span>
                </div>
            </div>
        </div>
    );
};
