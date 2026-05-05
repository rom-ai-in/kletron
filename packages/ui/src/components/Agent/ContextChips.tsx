'use client';

import React from 'react';
import {
    X, FileCode, Folder, Brain, Cpu, Hash, AtSign, Link, Zap,
} from 'lucide-react';

export type ChipVariant =
    | 'default'
    | 'file'
    | 'folder'
    | 'agent'
    | 'model'
    | 'tag'
    | 'mention'
    | 'link'
    /** Workspace slash skill selected from / palette (`skill:${slug}` ids) */
    | 'skill';

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
        case 'skill': return <Zap className="w-3 h-3" />;
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
        case 'skill':
            return 'bg-status-info-bg text-status-info-text border-status-info-border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]';
        default:
            return 'bg-bg-elevated text-text-secondary border-border-subtle';
    }
}

/** Same visual language as slash skill chips in the composer — use in thread Skills strip, docs, etc. */
export function SkillPill({ label, className = '' }: { label: string; className?: string }) {
    const styles = getChipStyles('skill');
    return (
        <span
            className={`inline-flex max-w-full items-center gap-1 rounded-full border text-[10px] px-2 py-0.5 transition-colors ${styles} ${className}`}
        >
            <Zap className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
            <span className="min-w-0 truncate">{label}</span>
        </span>
    );
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

/** Slash skill from / palette or mirrored from typed `/slug` — wire format via {@link composeMessageWithSlashSkillChips}. */
export function createSkillChip(slug: string, options?: { dismissible?: boolean }): ContextChip {
    const safe = slug.replace(/^\/+/, '').trim() || 'skill';
    return {
        id: `skill:${safe}`,
        label: `/${safe}`,
        variant: 'skill',
        dismissible: options?.dismissible ?? true,
    };
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
