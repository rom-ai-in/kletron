'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Command, ChevronRight, FileCode, Settings, Terminal, GitBranch, Folder, X } from 'lucide-react';

export interface CommandItem {
    id: string;
    label: string;
    description?: string;
    shortcut?: string;
    icon?: React.ReactNode;
    category?: string;
    action?: () => void;
}

export interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
    commands: CommandItem[];
    placeholder?: string;
    recentCommands?: string[];
    onSelect?: (command: CommandItem) => void;
}

export function CommandPalette({
    open,
    onClose,
    commands,
    placeholder = 'Type a command or search...',
    recentCommands = [],
    onSelect,
}: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!query) {
            // Show recent commands first, then all others
            const recent = commands.filter(c => recentCommands.includes(c.id));
            const others = commands.filter(c => !recentCommands.includes(c.id));
            return [...recent, ...others];
        }

        const lowerQuery = query.toLowerCase();
        return commands.filter(
            c =>
                c.label.toLowerCase().includes(lowerQuery) ||
                c.description?.toLowerCase().includes(lowerQuery) ||
                c.category?.toLowerCase().includes(lowerQuery)
        );
    }, [commands, query, recentCommands]);

    // Group by category
    const groupedCommands = useMemo(() => {
        const groups: Record<string, CommandItem[]> = {};
        filteredCommands.forEach(cmd => {
            const category = cmd.category || 'Commands';
            if (!groups[category]) groups[category] = [];
            groups[category].push(cmd);
        });
        return groups;
    }, [filteredCommands]);

    // Reset on open/close
    useEffect(() => {
        if (open) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(i => Math.max(i - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredCommands[selectedIndex]) {
                        handleSelect(filteredCommands[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, filteredCommands, selectedIndex, onClose]);

    // Scroll selected item into view
    useEffect(() => {
        const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
        selectedEl?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    const handleSelect = (command: CommandItem) => {
        command.action?.();
        onSelect?.(command);
        onClose();
    };

    if (!open) return null;

    let flatIndex = 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Palette */}
            <div
                className="relative w-full max-w-xl rounded-xl border border-border-subtle bg-bg-surface shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
                    <Search className="w-5 h-5 text-text-muted" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        placeholder={placeholder}
                        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                    />
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-bg-elevated border border-border-subtle">
                        <Command className="w-3 h-3 text-text-muted" />
                        <span className="text-[10px] text-text-muted">K</span>
                    </div>
                </div>

                {/* Command List */}
                <div ref={listRef} className="max-h-80 overflow-y-auto py-2 scrollbar-elegant">
                    {Object.entries(groupedCommands).map(([category, items]) => (
                        <div key={category}>
                            <div className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                                {category}
                            </div>
                            {items.map((cmd) => {
                                const currentIndex = flatIndex++;
                                return (
                                    <div
                                        key={cmd.id}
                                        data-index={currentIndex}
                                        className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${currentIndex === selectedIndex
                                                ? 'bg-bg-elevated text-text-primary'
                                                : 'text-text-primary hover:bg-state-hover'
                                            }`}
                                        onClick={() => handleSelect(cmd)}
                                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                                    >
                                        {cmd.icon || <ChevronRight className="w-4 h-4 text-text-muted" />}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm truncate">{cmd.label}</div>
                                            {cmd.description && (
                                                <div className="text-xs text-text-muted truncate">{cmd.description}</div>
                                            )}
                                        </div>
                                        {cmd.shortcut && (
                                            <div className="text-[10px] text-text-muted font-mono">{cmd.shortcut}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {filteredCommands.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-text-muted">
                            No commands found
                        </div>
                    )}
                </div>

                {/* Footer hint */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle text-[10px] text-text-muted">
                    <div className="flex items-center gap-4">
                        <span>↑↓ Navigate</span>
                        <span>↵ Select</span>
                        <span>Esc Close</span>
                    </div>
                    <span>{filteredCommands.length} commands</span>
                </div>
            </div>
        </div>
    );
}

// Default command icons for common actions
export const CommandIcons = {
    file: <FileCode className="w-4 h-4 text-text-secondary" />,
    settings: <Settings className="w-4 h-4 text-text-secondary" />,
    terminal: <Terminal className="w-4 h-4 text-text-secondary" />,
    git: <GitBranch className="w-4 h-4 text-text-secondary" />,
    folder: <Folder className="w-4 h-4 text-text-secondary" />,
};
