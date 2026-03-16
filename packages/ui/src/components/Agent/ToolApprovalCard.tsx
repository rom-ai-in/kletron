'use client';

import React, { useState, useCallback } from 'react';
import {
    Shield,
    ShieldCheck,
    ShieldX,
    Check,
    X,
    ChevronDown,
    Loader2,
    Terminal as TerminalIcon,
    FileText,
    Pencil,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ToolInvocationIcon } from './ToolInvocation';

/* ═══════════════════════════════════════════════════════════════════════════
 * Types
 * ═══════════════════════════════════════════════════════════════════════════ */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executing';

export type ApprovalPolicyValue = 'always_approve' | 'always_require' | 'default';

export interface ToolApprovalCardProps {
    /** The pending edit ID */
    editId: string;
    /** Tool name (e.g. "write_file", "execute_bash") */
    toolName: string;
    /** Human description (e.g. "Write file index.html") */
    description?: string;
    /** JSON-stringified args for display */
    args?: Record<string, any>;
    /** Current status */
    status: ApprovalStatus;
    /** Called when approved */
    onApprove: (editId: string) => Promise<void>;
    /** Called when rejected */
    onReject: (editId: string) => Promise<void>;
    /** Called when policy changes */
    onPolicyChange?: (toolName: string, policy: ApprovalPolicyValue) => Promise<void>;
    /** Current policy for this tool */
    currentPolicy?: ApprovalPolicyValue;
    /** Extra className */
    className?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PolicyDropdown — inline "Always approve" / "Always ask" / "Default"
 * ═══════════════════════════════════════════════════════════════════════════ */

function PolicyDropdown({
    toolName,
    currentPolicy = 'default',
    onPolicyChange,
    disabled,
}: {
    toolName: string;
    currentPolicy?: ApprovalPolicyValue;
    onPolicyChange?: (toolName: string, policy: ApprovalPolicyValue) => Promise<void>;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const options: { value: ApprovalPolicyValue; label: string; icon: React.ElementType; color: string }[] = [
        { value: 'always_approve', label: 'Always approve', icon: ShieldCheck, color: 'text-status-success-text' },
        { value: 'always_require', label: 'Always ask', icon: Shield, color: 'text-status-warning-text' },
        { value: 'default', label: 'Default policy', icon: Shield, color: 'text-text-muted' },
    ];

    const current = options.find((o) => o.value === currentPolicy) ?? options[2];
    const CurrentIcon = current.icon;

    const handleSelect = useCallback(async (value: ApprovalPolicyValue) => {
        if (!onPolicyChange || value === currentPolicy) {
            setOpen(false);
            return;
        }
        setSaving(true);
        try {
            await onPolicyChange(toolName, value);
        } finally {
            setSaving(false);
            setOpen(false);
        }
    }, [onPolicyChange, toolName, currentPolicy]);

    if (!onPolicyChange) return null;

    return (
        <div className="relative">
            <button
                type="button"
                disabled={disabled || saving}
                onClick={() => setOpen((prev) => !prev)}
                className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium',
                    'bg-bg-elevated text-text-muted border border-border-subtle',
                    'hover:bg-state-hover transition-colors',
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
            >
                {saving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                    <CurrentIcon className={cn('w-3 h-3', current.color)} />
                )}
                <span className="hidden sm:inline">{current.label}</span>
                <ChevronDown className={cn('w-2.5 h-2.5 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border-subtle bg-bg-surface shadow-lg backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {options.map((opt) => {
                        const OptIcon = opt.icon;
                        const isSelected = opt.value === currentPolicy;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleSelect(opt.value)}
                                className={cn(
                                    'flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] transition-colors',
                                    isSelected ? 'bg-state-active text-text-primary font-medium' : 'text-text-secondary hover:bg-state-hover'
                                )}
                            >
                                <OptIcon className={cn('w-3.5 h-3.5', opt.color)} />
                                {opt.label}
                                {isSelected && <Check className="w-3 h-3 ml-auto text-status-success-text" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ToolApprovalCard — the actual approval card
 * ═══════════════════════════════════════════════════════════════════════════ */

export function ToolApprovalCard({
    editId,
    toolName,
    description,
    args,
    status,
    onApprove,
    onReject,
    onPolicyChange,
    currentPolicy,
    className,
}: ToolApprovalCardProps) {
    const [loading, setLoading] = useState(false);
    const [localStatus, setLocalStatus] = useState<ApprovalStatus>(status);

    const handleApprove = useCallback(async () => {
        setLoading(true);
        setLocalStatus('executing');
        try {
            await onApprove(editId);
            setLocalStatus('approved');
        } catch {
            setLocalStatus('pending');
        } finally {
            setLoading(false);
        }
    }, [editId, onApprove]);

    const handleReject = useCallback(async () => {
        setLoading(true);
        try {
            await onReject(editId);
            setLocalStatus('rejected');
        } finally {
            setLoading(false);
        }
    }, [editId, onReject]);

    const effectiveStatus = localStatus !== status ? localStatus : status;
    const isPending = effectiveStatus === 'pending';
    const isExecuting = effectiveStatus === 'executing';

    // Border & background colors per status
    const borderColor = isPending || isExecuting
        ? 'border-status-warning-border'
        : effectiveStatus === 'approved'
            ? 'border-[var(--agent-success-border)]'
            : 'border-[var(--agent-error-border)]';

    const bgColor = isPending || isExecuting
        ? 'bg-status-warning-bg/30'
        : effectiveStatus === 'approved'
            ? 'bg-[var(--agent-success-bg)]/30'
            : 'bg-[var(--agent-error-bg)]/30';

    // Friendly file name
    const fileName = args?.filePath?.split('/').pop()
        ?? args?.path?.split('/').pop()
        ?? args?.command?.slice(0, 60)
        ?? '';

    return (
        <div className={cn(
            'rounded-lg border overflow-hidden transition-all duration-200',
            borderColor,
            bgColor,
            className,
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle/50">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={cn(
                        'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
                        isPending ? 'bg-status-warning-bg' : effectiveStatus === 'approved' ? 'bg-[var(--agent-success-bg)]' : 'bg-[var(--agent-error-bg)]',
                    )}>
                        {isExecuting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-status-warning-text" />
                        ) : (
                            <ToolInvocationIcon name={toolName} className="w-3.5 h-3.5" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-text-primary truncate">
                            {description || `Run ${toolName}`}
                        </div>
                        {fileName && (
                            <div className="text-[10px] font-mono text-text-muted truncate max-w-[250px]">
                                {fileName}
                            </div>
                        )}
                    </div>
                </div>

                {/* Status badge or action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {isPending ? (
                        <>
                            <button
                                onClick={handleApprove}
                                disabled={loading}
                                className={cn(
                                    'flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold',
                                    'bg-[var(--agent-success-bg)] text-[var(--agent-success)] border border-[var(--agent-success-border)]',
                                    'hover:brightness-110 active:scale-95 transition-all',
                                    loading && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <Check className="w-3.5 h-3.5" />
                                Approve
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={loading}
                                className={cn(
                                    'flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold',
                                    'bg-[var(--agent-error-bg)] text-[var(--agent-error)] border border-[var(--agent-error-border)]',
                                    'hover:brightness-110 active:scale-95 transition-all',
                                    loading && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <X className="w-3.5 h-3.5" />
                                Reject
                            </button>
                        </>
                    ) : isExecuting ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-medium text-status-warning-text">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Executing…
                        </span>
                    ) : (
                        <span className={cn(
                            'text-[10px] font-bold uppercase tracking-wider',
                            effectiveStatus === 'approved' ? 'text-[var(--agent-success)]' : 'text-[var(--agent-error)]'
                        )}>
                            {effectiveStatus === 'approved' ? '✓ Approved' : '✗ Rejected'}
                        </span>
                    )}
                </div>
            </div>

            {/* Footer — policy override */}
            {onPolicyChange && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-bg-app/40">
                    <span className="text-[9px] text-text-muted uppercase tracking-wider font-semibold">
                        Policy for {toolName}
                    </span>
                    <PolicyDropdown
                        toolName={toolName}
                        currentPolicy={currentPolicy}
                        onPolicyChange={onPolicyChange}
                        disabled={loading}
                    />
                </div>
            )}
        </div>
    );
}
