'use client';

import React from 'react';
import {
    Files, Search, GitBranch, Bug, Brain, Settings,
    MessageSquare, Box, Layers, Database
} from 'lucide-react';

export interface ActivityBarItem {
    id: string;
    icon: React.ReactNode;
    label: string;
    badge?: number | string;
    badgeVariant?: 'default' | 'info' | 'success' | 'warning' | 'error';
}

export interface ActivityBarProps {
    items?: ActivityBarItem[];
    activeItemId?: string;
    onItemClick?: (item: ActivityBarItem) => void;
    bottomItems?: ActivityBarItem[];
    className?: string;
}

// Default activity bar items matching VS Code / Cursor
export const defaultActivityItems: ActivityBarItem[] = [
    { id: 'explorer', icon: <Files className="w-6 h-6" />, label: 'Explorer' },
    { id: 'search', icon: <Search className="w-6 h-6" />, label: 'Search' },
    { id: 'git', icon: <GitBranch className="w-6 h-6" />, label: 'Source Control' },
    { id: 'debug', icon: <Bug className="w-6 h-6" />, label: 'Run and Debug' },
    { id: 'ai', icon: <Brain className="w-6 h-6" />, label: 'AI Assistant' },
];

export const defaultBottomItems: ActivityBarItem[] = [
    { id: 'settings', icon: <Settings className="w-6 h-6" />, label: 'Settings' },
];

function getBadgeColor(variant: ActivityBarItem['badgeVariant']) {
    switch (variant) {
        case 'info': return 'bg-status-info';
        case 'success': return 'bg-status-success';
        case 'warning': return 'bg-status-warning';
        case 'error': return 'bg-status-error';
        default: return 'bg-[var(--activitybar-badge-bg)]';
    }
}

export function ActivityBar({
    items = defaultActivityItems,
    activeItemId,
    onItemClick,
    bottomItems = defaultBottomItems,
    className = '',
}: ActivityBarProps) {
    const renderItem = (item: ActivityBarItem) => {
        const isActive = item.id === activeItemId;

        return (
            <div
                key={item.id}
                className={`relative flex items-center justify-center w-12 h-12 cursor-pointer transition-colors group
          ${isActive
                        ? 'text-[var(--activitybar-fg-active)]'
                        : 'text-[var(--activitybar-fg)] hover:text-[var(--activitybar-fg-active)]'
                    }
        `}
                onClick={() => onItemClick?.(item)}
                title={item.label}
            >
                {/* Active indicator bar */}
                {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[var(--activitybar-fg-active)] rounded-r" />
                )}

                {/* Icon */}
                {item.icon}

                {/* Badge */}
                {item.badge !== undefined && (
                    <span
                        className={`absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center 
              text-[10px] font-medium text-[var(--activitybar-badge-fg)] rounded-full
              ${getBadgeColor(item.badgeVariant)}
            `}
                    >
                        {item.badge}
                    </span>
                )}

                {/* Tooltip on hover */}
                <div className="absolute left-full ml-2 px-2 py-1 rounded bg-bg-surface border border-border-subtle text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {item.label}
                </div>
            </div>
        );
    };

    return (
        <div
            className={`flex flex-col items-center w-12 bg-[var(--activitybar-bg)] border-r border-[var(--sidebar-border)] ${className}`}
        >
            {/* Top items */}
            <div className="flex flex-col items-center flex-1 pt-1">
                {items.map(renderItem)}
            </div>

            {/* Bottom items */}
            <div className="flex flex-col items-center pb-1">
                {bottomItems.map(renderItem)}
            </div>
        </div>
    );
}

// Icon exports for custom activity items
export const ActivityIcons = {
    files: <Files className="w-6 h-6" />,
    search: <Search className="w-6 h-6" />,
    git: <GitBranch className="w-6 h-6" />,
    debug: <Bug className="w-6 h-6" />,
    ai: <Brain className="w-6 h-6" />,
    chat: <MessageSquare className="w-6 h-6" />,
    extensions: <Box className="w-6 h-6" />,
    layers: <Layers className="w-6 h-6" />,
    database: <Database className="w-6 h-6" />,
    settings: <Settings className="w-6 h-6" />,
};
