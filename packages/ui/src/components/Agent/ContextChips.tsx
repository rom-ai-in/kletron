'use client';

import React from 'react';
import {
    X, FileCode, Folder, Brain, Cpu, Hash, AtSign,
    Code2, Terminal, Database, Globe, Link
} from 'lucide-react';

export type ChipVariant = 'default' | 'file' | 'folder' | 'agent' | 'model' | 'tag' | 'mention' | 'link';

export interface ContextChip {
    id: string;
    label: string;
    variant?: ChipVariant;
    icon?: React.ReactNode;
    dismissible?: boolean;
    onClick?: () => void;
}

export interface ContextChipsProps {
    chips: ContextChip[];
    onDismiss?: (chipId: string) => void;
    onChipClick?: (chip: ContextChip) => void;
    size?: 'sm' | 'md';
    className?: string;
}

function getChipIcon(variant: ChipVariant): React.ReactNode {
    switch (variant) {
        case 'file': return <FileCode className="w-3 h-3" />;
        case 'folder': return <Folder className="w-3 h-3" />;
        case 'agent': return <Brain className="w-3 h-3" />;
        case 'model': return <Cpu className="w-3 h-3" />;
        case 'tag': return <Hash className="w-3 h-3" />;
        case 'mention': return <AtSign className="w-3 h-3" />;
        case 'link': return <Link className="w-3 h-3" />;
        default: return null;
    }
}

function getChipStyles(variant: ChipVariant): string {
    switch (variant) {
        case 'file':
            return 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30';
        case 'folder':
            return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
        case 'agent':
            return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
        case 'model':
            return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
        case 'tag':
            return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
        case 'mention':
            return 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30';
        case 'link':
            return 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30';
        default:
            return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
}

export function ContextChips({
    chips,
    onDismiss,
    onChipClick,
    size = 'sm',
    className = '',
}: ContextChipsProps) {
    const sizeClasses = size === 'sm'
        ? 'text-[10px] px-2 py-0.5 gap-1'
        : 'text-xs px-2.5 py-1 gap-1.5';

    return (
        <div className={`flex flex-wrap gap-1.5 ${className}`}>
            {chips.map((chip) => {
                const variant = chip.variant || 'default';
                const icon = chip.icon || getChipIcon(variant);
                const styles = getChipStyles(variant);

                return (
                    <div
                        key={chip.id}
                        className={`inline-flex items-center rounded-full border transition-colors
              ${sizeClasses}
              ${styles}
              ${chip.onClick || onChipClick ? 'cursor-pointer hover:opacity-80' : ''}
            `}
                        onClick={() => {
                            chip.onClick?.();
                            onChipClick?.(chip);
                        }}
                    >
                        {icon && <span className="flex-shrink-0">{icon}</span>}
                        <span className="truncate max-w-[120px]">{chip.label}</span>

                        {chip.dismissible !== false && onDismiss && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDismiss(chip.id);
                                }}
                                className="flex-shrink-0 ml-0.5 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// Pre-built chip factories for convenience
export function createFileChip(filename: string, id?: string): ContextChip {
    return { id: id || filename, label: filename, variant: 'file', dismissible: true };
}

export function createFolderChip(foldername: string, id?: string): ContextChip {
    return { id: id || foldername, label: foldername, variant: 'folder', dismissible: true };
}

export function createAgentChip(agentName: string, id?: string): ContextChip {
    return { id: id || agentName, label: agentName, variant: 'agent', dismissible: false };
}

export function createModelChip(modelName: string, id?: string): ContextChip {
    return { id: id || modelName, label: modelName, variant: 'model', dismissible: false };
}

export function createTagChip(tag: string, id?: string): ContextChip {
    return { id: id || tag, label: tag, variant: 'tag', dismissible: true };
}
