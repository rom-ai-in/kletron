"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Folder, AlertCircle, Check, Loader2, FolderOpen, ChevronUp, ChevronRight, Plus } from 'lucide-react';
import { Button, Panel } from '@kletron/ui/components/design-system';

export interface InlineAddWorkspaceFormProps {
    onCreated?: (workspace: { id: string; name: string; rootPath: string }) => void;
}

type ValidationState = {
    valid: boolean;
    checked: boolean;
    error?: string;
};

type GitValidationState = {
    valid: boolean;
    checked: boolean;
    error?: string;
    currentBranch?: string;
};

type BrowseEntry = {
    name: string;
    path: string;
    isDirectory: boolean;
};

const INITIAL_VALIDATION: ValidationState = { valid: false, checked: false };
const INITIAL_GIT_VALIDATION: GitValidationState = { valid: false, checked: false };

export function InlineAddWorkspaceForm({ onCreated }: InlineAddWorkspaceFormProps) {
    const [rootPath, setRootPath] = useState('');
    const [name, setName] = useState('');
    const [validating, setValidating] = useState(false);
    const [validation, setValidation] = useState<ValidationState>(INITIAL_VALIDATION);
    const [gitValidation, setGitValidation] = useState<GitValidationState>(INITIAL_GIT_VALIDATION);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pathInputRef = useRef<HTMLInputElement>(null);

    // Folder browser state
    const [showBrowser, setShowBrowser] = useState(false);
    const [browsePath, setBrowsePath] = useState<string>('');
    const [browseParent, setBrowseParent] = useState<string | null>(null);
    const [browseEntries, setBrowseEntries] = useState<BrowseEntry[]>([]);
    const [browseLoading, setBrowseLoading] = useState(false);

    const validatePath = useCallback(async (path: string) => {
        if (!path.trim()) {
            setValidation(INITIAL_VALIDATION);
            setGitValidation(INITIAL_GIT_VALIDATION);
            return;
        }

        setValidating(true);
        setError(null);
        try {
            const res = await fetch('/api/validation/folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path.trim() }),
            });
            const data = await res.json();
            setValidation({ checked: true, valid: data.valid, error: data.error });

            if (data.valid) {
                try {
                    const gitRes = await fetch('/api/validation/git', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: path.trim() }),
                    });
                    const gitData = await gitRes.json();
                    setGitValidation({
                        checked: true,
                        valid: !!gitData.valid,
                        error: gitData.error,
                        currentBranch: gitData.currentBranch,
                    });
                } catch {
                    setGitValidation({ checked: true, valid: false, error: 'Failed to check git status' });
                }
            } else {
                setGitValidation(INITIAL_GIT_VALIDATION);
            }
        } catch {
            setValidation({ checked: true, valid: false, error: 'Failed to validate path' });
            setGitValidation(INITIAL_GIT_VALIDATION);
        } finally {
            setValidating(false);
        }
    }, []);

    const handlePathBlur = useCallback(() => {
        if (rootPath.trim()) {
            void validatePath(rootPath);
            if (!name.trim()) {
                const parts = rootPath.trim().split('/').filter(Boolean);
                const derived = parts[parts.length - 1] || '';
                setName(derived);
            }
        }
    }, [rootPath, name, validatePath]);

    // Folder browser functions
    const browseTo = useCallback(async (dirPath?: string) => {
        setBrowseLoading(true);
        try {
            const url = dirPath
                ? `/api/fs/browse?path=${encodeURIComponent(dirPath)}`
                : '/api/fs/browse';
            const res = await fetch(url);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as Record<string, string>).error || 'Failed to browse');
            }
            const data = await res.json();
            setBrowsePath(data.current);
            setBrowseParent(data.parent);
            setBrowseEntries(data.entries || []);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBrowseLoading(false);
        }
    }, []);

    const handleOpenBrowser = useCallback(() => {
        setShowBrowser(prev => !prev);
        if (!showBrowser) void browseTo(rootPath.trim() || undefined);
    }, [showBrowser, rootPath, browseTo]);

    const handleSelectFolder = useCallback((folderPath: string) => {
        setRootPath(folderPath);
        setShowBrowser(false);
        void validatePath(folderPath);
        // Auto-derive name
        if (!name.trim()) {
            const parts = folderPath.split('/').filter(Boolean);
            const derived = parts[parts.length - 1] || '';
            setName(derived);
        }
    }, [name, validatePath]);

    const handleCreate = useCallback(async () => {
        if (!validation.valid || saving) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rootPath: rootPath.trim(), name: name.trim() || undefined }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as Record<string, string>).error || 'Failed to create workspace');
            }
            const data = await res.json();
            // Reset form on success
            setRootPath('');
            setName('');
            setValidation(INITIAL_VALIDATION);
            setGitValidation(INITIAL_GIT_VALIDATION);
            onCreated?.(data.workspace);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    }, [rootPath, name, validation.valid, saving, onCreated]);

    return (
        <Panel className="p-0 overflow-hidden border border-border-default shadow-sm mb-6">
            <div className="border-b border-border-subtle bg-bg-elevated/50 px-5 py-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-state-hover flex items-center justify-center border border-border-subtle">
                    <Plus className="h-4 w-4 text-text-primary" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-text-primary">Add New Workspace</h2>
                    <p className="text-xs text-text-muted mt-0.5">Connect a local folder to track an agentic workspace</p>
                </div>
            </div>

            <div className="p-5 space-y-5 bg-bg-surface">
                {error && (
                    <div className="rounded-md border border-status-error-border bg-status-error-bg px-4 py-3 text-[13px] text-status-error-text flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-[12px] font-semibold text-text-secondary">
                        Absolute Directory Path
                    </label>
                    <div className="flex gap-2">
                        <input
                            ref={pathInputRef}
                            value={rootPath}
                            onChange={(e) => setRootPath(e.target.value)}
                            onBlur={handlePathBlur}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handlePathBlur();
                            }}
                            placeholder="/Users/yourname/projects/my-app"
                            className="flex-1 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-strong transition-colors ring-0 focus:ring-1 focus:ring-border-strong"
                        />
                        <button
                            type="button"
                            onClick={handleOpenBrowser}
                            className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${showBrowser ? 'bg-bg-component-hover border-border-strong text-text-primary' : 'border-border-subtle bg-bg-elevated text-text-secondary hover:bg-bg-component-hover'}`}
                            title="Browse folders"
                        >
                            <FolderOpen className="h-4 w-4" />
                            Browse
                        </button>
                    </div>

                    {/* Inline Folder Browser */}
                    {showBrowser && (
                        <div className="rounded-md border border-border-subtle bg-bg-elevated overflow-hidden mt-3 animate-in slide-in-from-top-2 fade-in duration-200">
                            {/* Browser header with current path */}
                            <div className="flex items-center gap-2 border-b border-border-subtle bg-bg-app px-3 py-2">
                                {browseParent && (
                                    <button
                                        onClick={() => void browseTo(browseParent)}
                                        className="rounded p-1.5 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                                        title="Go up"
                                    >
                                        <ChevronUp className="h-4 w-4" />
                                    </button>
                                )}
                                <span className="text-[12px] text-text-muted truncate flex-1 font-mono">
                                    {browsePath || '/'}
                                </span>
                                <button
                                    onClick={() => handleSelectFolder(browsePath)}
                                    className="rounded-md px-3 py-1.5 text-[11px] font-medium bg-text-primary text-bg-surface hover:opacity-90 transition-colors"
                                >
                                    Select This Directory
                                </button>
                            </div>
                            {/* Directory listing */}
                            <div className="max-h-56 overflow-y-auto scrollbar-elegant">
                                {browseLoading ? (
                                    <div className="flex items-center justify-center py-8 text-text-muted">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                ) : browseEntries.length === 0 ? (
                                    <div className="py-6 text-center text-[12px] text-text-muted">
                                        No subdirectories
                                    </div>
                                ) : (
                                    browseEntries.map((entry) => (
                                        <button
                                            key={entry.path}
                                            onClick={() => void browseTo(entry.path)}
                                            onDoubleClick={() => handleSelectFolder(entry.path)}
                                            className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-state-hover transition-colors group"
                                        >
                                            <Folder className="h-4 w-4 text-text-muted flex-shrink-0 group-hover:text-text-primary transition-colors" />
                                            <span className="truncate flex-1">{entry.name}</span>
                                            <ChevronRight className="h-3.5 w-3.5 text-text-muted flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Validation indicators */}
                    <div className="h-5 mt-2 flex items-center">
                        {validating && (
                            <div className="flex items-center gap-2 text-[12px] text-text-muted animate-pulse">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Validating path...
                            </div>
                        )}
                        {!validating && validation.checked && (
                            <div className={`flex items-center gap-4 text-[12px]`}>
                                <div className={`flex items-center gap-1.5 ${validation.valid ? 'text-status-success-text' : 'text-status-error-text'}`}>
                                    {validation.valid ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                                    {validation.valid ? 'Directory located' : (validation.error || 'Invalid path')}
                                </div>
                                {validation.valid && gitValidation.checked && (
                                    <div className={`flex items-center gap-1.5 ${gitValidation.valid ? 'text-text-secondary' : 'text-status-warning-text'}`}>
                                        {gitValidation.valid ? <Folder className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                                        {gitValidation.valid
                                            ? `Git initialized (${gitValidation.currentBranch || 'detected'})`
                                            : (gitValidation.error || 'Not a git repository')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[12px] font-semibold text-text-secondary">
                        Project Name
                    </label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && validation.valid && !saving) {
                                e.preventDefault();
                                void handleCreate();
                            }
                        }}
                        placeholder="Optionally override the default name"
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-strong transition-colors ring-0 focus:ring-1 focus:ring-border-strong"
                    />
                </div>
            </div>

            <div className="bg-bg-elevated/30 border-t border-border-subtle px-5 py-3 flex justify-end">
                <Button
                    onClick={() => void handleCreate()}
                    disabled={!validation.valid || saving}
                    variant="primary"
                    className="w-full sm:w-auto px-6"
                >
                    {saving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Provisioning Workspace...
                        </>
                    ) : (
                        'Add Workspace'
                    )}
                </Button>
            </div>
        </Panel>
    );
}
