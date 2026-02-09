'use client';

import React from 'react';
import { GitBranch, AlertCircle, AlertTriangle, Bell, Check, Loader2 } from 'lucide-react';

export interface StatusBarItem {
    id: string;
    content: React.ReactNode;
    align: 'left' | 'right';
    priority?: number;
    onClick?: () => void;
    tooltip?: string;
}

export interface StatusBarProps {
    items?: StatusBarItem[];
    // Convenience props for common items
    branch?: string;
    syncStatus?: 'synced' | 'syncing' | 'behind' | 'ahead';
    problems?: { errors: number; warnings: number };
    language?: string;
    encoding?: string;
    lineInfo?: string;
    llmModel?: string;
    className?: string;
}

export function StatusBar({
    items = [],
    branch,
    syncStatus,
    problems,
    language,
    encoding,
    lineInfo,
    llmModel,
    className = '',
}: StatusBarProps) {
    // Build default items from convenience props
    const defaultItems: StatusBarItem[] = [];

    if (branch) {
        defaultItems.push({
            id: 'branch',
            align: 'left',
            priority: 1,
            content: (
                <span className="flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>{branch}</span>
                    {syncStatus === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {syncStatus === 'synced' && <Check className="w-3 h-3 text-status-success-text" />}
                </span>
            ),
        });
    }

    if (problems) {
        defaultItems.push({
            id: 'problems',
            align: 'left',
            priority: 2,
            content: (
                <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-status-error-text" />
                        <span>{problems.errors}</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-status-warning-text" />
                        <span>{problems.warnings}</span>
                    </span>
                </span>
            ),
        });
    }

    if (llmModel) {
        defaultItems.push({
            id: 'llm',
            align: 'right',
            priority: 1,
            content: (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-state-active">
                    <span className="text-[10px]">🤖</span>
                    <span>{llmModel}</span>
                </span>
            ),
        });
    }

    if (lineInfo) {
        defaultItems.push({
            id: 'lineInfo',
            align: 'right',
            priority: 2,
            content: <span>{lineInfo}</span>,
        });
    }

    if (encoding) {
        defaultItems.push({
            id: 'encoding',
            align: 'right',
            priority: 3,
            content: <span>{encoding}</span>,
        });
    }

    if (language) {
        defaultItems.push({
            id: 'language',
            align: 'right',
            priority: 4,
            content: <span>{language}</span>,
        });
    }

    // Merge custom items with defaults
    const allItems = [...defaultItems, ...items].sort((a, b) => (a.priority || 99) - (b.priority || 99));

    const leftItems = allItems.filter(i => i.align === 'left');
    const rightItems = allItems.filter(i => i.align === 'right');

    return (
        <div
            className={`flex items-center justify-between h-[22px] px-2 text-[11px] border-t border-[var(--statusbar-border,var(--vscode-statusBar-border))] bg-[var(--statusbar-bg,var(--vscode-statusBar-background))] text-[var(--statusbar-fg,var(--vscode-statusBar-foreground))] ${className}`}
        >
            {/* Left side */}
            <div className="flex items-center gap-3">
                {leftItems.map(item => (
                    <div
                        key={item.id}
                        className={`flex items-center ${item.onClick ? 'cursor-pointer hover:bg-state-active px-1 rounded' : ''}`}
                        onClick={item.onClick}
                        title={item.tooltip}
                    >
                        {item.content}
                    </div>
                ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
                {rightItems.map(item => (
                    <div
                        key={item.id}
                        className={`flex items-center ${item.onClick ? 'cursor-pointer hover:bg-state-active px-1 rounded' : ''}`}
                        onClick={item.onClick}
                        title={item.tooltip}
                    >
                        {item.content}
                    </div>
                ))}
            </div>
        </div>
    );
}
