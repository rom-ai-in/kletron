"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Search, Terminal as TerminalIcon, ShieldCheck, Globe, Zap } from 'lucide-react';

interface Command {
    id: string;
    label: string;
    icon: React.ReactNode;
    action: () => void;
}

export const SlashPalette: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const commands: Command[] = [
        {
            id: 'audit',
            label: 'Run Forensic Audit',
            icon: <ShieldCheck size={16} />,
            action: () => {
                console.info('Aria: Triggering Forensic Audit Agent...');
                // Trigger actual background task here if API exists
            }
        },
        {
            id: 'drift',
            label: 'Start Drift Analyzer',
            icon: <Zap size={16} />,
            action: () => {
                console.info('Aria: Starting Drift Analysis...');
            }
        },
        {
            id: 'translate',
            label: 'Extract & Translate Strings',
            icon: <Globe size={16} />,
            action: () => {
                console.info('Aria: Queueing Translation Job...');
            }
        },
        {
            id: 'term-run',
            label: 'Run npm test',
            icon: <TerminalIcon size={16} />,
            action: () => {
                console.info('Aria: Executing npm test in terminal...');
                // Integration with Terminal component would go here
            }
        },
    ];

    const filteredCommands = commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const onKeydown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
                setQuery('');
                setSelectedIndex(0);
            }
            if (isOpen && e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', onKeydown);
        return () => window.removeEventListener('keydown', onKeydown);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        } else if (e.key === 'ArrowUp') {
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            if (filteredCommands[selectedIndex]) {
                const cmd = filteredCommands[selectedIndex];
                cmd.action();
                // In a real app, we might fire a toast or callback
                alert(`Executed: ${cmd.label}`);
                setIsOpen(false);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-md">
            <div className="w-[500px] bg-bg-elevated border border-border-strong rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[50vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center px-4 py-3 border-b border-border-subtle">
                    <Search className="text-text-muted mr-2" size={18} />
                    <input
                        ref={inputRef}
                        className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder-text-muted"
                        placeholder="Type a command or search..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="text-[10px] font-bold text-text-muted border border-border-subtle rounded px-1.5 py-0.5 bg-bg-surface">ESC</div>
                </div>
                <div className="overflow-y-auto p-2">
                    {filteredCommands.length > 0 ? (
                        filteredCommands.map((item, i) => (
                            <div
                                key={item.id}
                                className={`flex items-center px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${i === selectedIndex
                                    ? 'bg-state-selected text-text-primary border border-border-strong'
                                    : 'text-text-secondary hover:bg-state-hover hover:text-text-primary border border-transparent'
                                    }`}
                                onClick={() => {
                                    item.action();
                                    setIsOpen(false);
                                }}
                            >
                                <span className="mr-3 text-zinc-400">{item.icon}</span>
                                <span>{item.label}</span>
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-8 text-center text-sm text-zinc-500">
                            No commands found.
                        </div>
                    )}
                </div>
                <div className="bg-bg-surface px-4 py-2 border-t border-border-subtle text-[10px] text-text-muted flex justify-between uppercase font-bold tracking-widest">
                    <span>Numezis Agent Aria</span>
                    <span className="opacity-50">Press Enter to select</span>
                </div>
            </div>
        </div>
    );
};
