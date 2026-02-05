'use client';

import React from 'react';
import { X, FileCode, FileJson, FileText, Circle } from 'lucide-react';

export interface EditorTab {
    id: string;
    filename: string;
    filepath?: string;
    isModified?: boolean;
    isPinned?: boolean;
    icon?: React.ReactNode;
}

export interface EditorTabsProps {
    tabs: EditorTab[];
    activeTabId?: string;
    onTabSelect?: (tab: EditorTab) => void;
    onTabClose?: (tab: EditorTab) => void;
    onTabPin?: (tab: EditorTab) => void;
    className?: string;
}

// Get icon based on filename
function getTabIcon(filename: string): React.ReactNode {
    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
        case 'ts':
        case 'tsx':
        case 'js':
        case 'jsx':
            return <FileCode className="w-4 h-4 text-sky-400" />;
        case 'json':
            return <FileJson className="w-4 h-4 text-amber-400" />;
        default:
            return <FileText className="w-4 h-4 text-zinc-400" />;
    }
}

export function EditorTabs({
    tabs,
    activeTabId,
    onTabSelect,
    onTabClose,
    onTabPin,
    className = '',
}: EditorTabsProps) {
    // Separate pinned and regular tabs
    const pinnedTabs = tabs.filter(t => t.isPinned);
    const regularTabs = tabs.filter(t => !t.isPinned);
    const sortedTabs = [...pinnedTabs, ...regularTabs];

    return (
        <div
            className={`flex items-stretch overflow-x-auto bg-[var(--tab-inactive-bg)] border-b border-[var(--tab-border)] scrollbar-elegant ${className}`}
            style={{ height: 35 }}
        >
            {sortedTabs.map((tab) => {
                const isActive = tab.id === activeTabId;

                return (
                    <div
                        key={tab.id}
                        className={`flex items-center gap-2 px-3 min-w-[120px] max-w-[200px] cursor-pointer transition-colors border-r border-[var(--tab-border)] group
              ${isActive
                                ? 'bg-[var(--tab-active-bg)] text-zinc-100'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                            }
              ${tab.isPinned ? 'italic' : ''}
            `}
                        onClick={() => onTabSelect?.(tab)}
                        onDoubleClick={() => onTabPin?.(tab)}
                        title={tab.filepath || tab.filename}
                    >
                        {/* File Icon */}
                        <span className="flex-shrink-0">
                            {tab.icon || getTabIcon(tab.filename)}
                        </span>

                        {/* Filename */}
                        <span className="flex-1 text-xs truncate">
                            {tab.filename}
                        </span>

                        {/* Modified indicator or Close button */}
                        <span
                            className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTabClose?.(tab);
                            }}
                        >
                            {tab.isModified ? (
                                <Circle
                                    className="w-2 h-2 fill-[var(--tab-modified)] text-[var(--tab-modified)] group-hover:hidden"
                                />
                            ) : null}
                            <X
                                className={`w-3 h-3 text-zinc-500 hover:text-zinc-200 transition-colors
                  ${tab.isModified ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'}
                `}
                            />
                        </span>
                    </div>
                );
            })}

            {/* Empty space filler */}
            <div className="flex-1 bg-[var(--tab-inactive-bg)]" />
        </div>
    );
}
