'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Upload, Pencil, Check, X } from 'lucide-react';

export interface EnvVariable {
    key: string;
    value: string;
    secret?: boolean;
}

export interface EnvironmentConfigProps {
    variables: EnvVariable[];
    onAdd?: (variable: EnvVariable) => void;
    onRemove?: (key: string) => void;
    onEdit?: (key: string, value: string) => void;
    onImportFromFile?: () => void;
    className?: string;
}

export function EnvironmentConfig({
    variables,
    onAdd,
    onRemove,
    onEdit,
    onImportFromFile,
    className = '',
}: EnvironmentConfigProps) {
    const [showAdd, setShowAdd] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [newSecret, setNewSecret] = useState(false);
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    function handleAdd() {
        if (!newKey.trim()) return;
        onAdd?.({ key: newKey.trim(), value: newValue, secret: newSecret });
        setNewKey('');
        setNewValue('');
        setNewSecret(false);
        setShowAdd(false);
    }

    function toggleVisibility(key: string) {
        setVisibleKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {variables.map(variable => (
                <div key={variable.key}>
                    {editingKey === variable.key ? (
                        <div className="flex items-center gap-2 rounded-md border border-border-strong bg-bg-surface px-3 py-2">
                            <div className="text-xs font-mono font-medium text-text-primary shrink-0">{variable.key}</div>
                            <input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                type={variable.secret ? 'password' : 'text'}
                                className="flex-1 rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary font-mono focus:border-border-strong focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        onEdit?.(variable.key, editValue);
                                        setEditingKey(null);
                                    }
                                    if (e.key === 'Escape') setEditingKey(null);
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setEditingKey(null)}
                                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                                title="Cancel"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onEdit?.(variable.key, editValue);
                                    setEditingKey(null);
                                }}
                                className="p-1 rounded text-status-success-text hover:bg-state-hover transition-colors"
                                title="Save"
                            >
                                <Check className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface/50 px-3 py-2">
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-mono font-medium text-text-primary">{variable.key}</div>
                                <div className="text-[10px] font-mono text-text-muted truncate">
                                    {variable.secret && !visibleKeys.has(variable.key)
                                        ? '••••••••'
                                        : variable.value || '(empty)'}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {onEdit && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingKey(variable.key);
                                            setEditValue(variable.value);
                                        }}
                                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                                        title="Edit"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {variable.secret && (
                                    <button
                                        type="button"
                                        onClick={() => toggleVisibility(variable.key)}
                                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                                        title={visibleKeys.has(variable.key) ? 'Hide' : 'Show'}
                                    >
                                        {visibleKeys.has(variable.key)
                                            ? <EyeOff className="w-3.5 h-3.5" />
                                            : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`Remove ${variable.key}?`)) {
                                            onRemove?.(variable.key);
                                        }
                                    }}
                                    className="p-1 rounded text-text-muted hover:text-status-error-text hover:bg-state-hover transition-colors"
                                    title="Remove"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {variables.length === 0 && !showAdd && (
                <div className="rounded-md border border-border-subtle px-3 py-4 text-xs text-text-muted text-center">
                    No environment variables configured.
                </div>
            )}

            {showAdd ? (
                <div className="rounded-md border border-border-strong bg-bg-surface p-3 space-y-2">
                    <input
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                        placeholder="KEY_NAME"
                        className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none font-mono"
                    />
                    <input
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="Value"
                        type={newSecret ? 'password' : 'text'}
                        className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none font-mono"
                    />
                    <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                        <input
                            type="checkbox"
                            checked={newSecret}
                            onChange={(e) => setNewSecret(e.target.checked)}
                            className="rounded border-border-strong"
                        />
                        Sensitive value (masked)
                    </label>
                    <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs text-text-muted hover:text-text-primary">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={!newKey.trim()}
                            className="rounded-md bg-bg-elevated border border-border-strong px-3 py-1 text-xs text-text-primary hover:bg-state-active disabled:opacity-50"
                        >
                            Add Variable
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-2 flex-1 rounded-md border border-dashed border-border-strong px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Variable
                    </button>
                    {onImportFromFile && (
                        <button
                            type="button"
                            onClick={onImportFromFile}
                            className="flex items-center gap-2 rounded-md border border-dashed border-border-strong px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            Import .env
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
