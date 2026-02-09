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
            return 'bg-text-muted/10 text-text-secondary border-border-subtle';
        case 'folder':
            return 'bg-status-warning-bg text-status-warning-text border-status-warning-border';
        case 'agent':
            return 'bg-status-success-bg text-status-success-text border-status-success-border';
        case 'model':
            return 'bg-status-success-bg text-status-success-text border-status-success-border';
        case 'tag':
            return 'bg-status-error-bg text-status-error-text border-status-error-border';
        case 'mention':
            return 'bg-text-muted/10 text-text-secondary border-border-subtle';
        case 'link':
            return 'bg-text-muted/10 text-text-secondary border-border-subtle';
        default:
            return 'bg-bg-elevated text-text-secondary border-border-subtle';
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
                                className="flex-shrink-0 ml-0.5 p-0.5 rounded-full hover:bg-state-active transition-colors"
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
