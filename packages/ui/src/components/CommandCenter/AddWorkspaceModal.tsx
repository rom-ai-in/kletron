'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Folder, AlertCircle, Check, Loader2, X, FolderOpen, ChevronUp, ChevronRight } from 'lucide-react';

export interface AddWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
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

export function AddWorkspaceModal({ open, onClose, onCreated }: AddWorkspaceModalProps) {
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

  // Reset all state when modal opens
  useEffect(() => {
    if (open) {
      setRootPath('');
      setName('');
      setValidating(false);
      setValidation(INITIAL_VALIDATION);
      setGitValidation(INITIAL_GIT_VALIDATION);
      setSaving(false);
      setError(null);
      setShowBrowser(false);
      setBrowseEntries([]);
      requestAnimationFrame(() => {
        pathInputRef.current?.focus();
      });
    }
  }, [open]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

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
    setShowBrowser(true);
    void browseTo(rootPath.trim() || undefined);
  }, [rootPath, browseTo]);

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
      onCreated?.(data.workspace);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [rootPath, name, validation.valid, saving, onCreated, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border-subtle bg-bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Folder className="h-4 w-4 text-text-muted" />
            Add New Workspace
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-md border border-status-error-border bg-status-error-bg px-3 py-2 text-[12px] text-status-error-text">
              {error}
            </div>
          )}

          {/* Folder Path */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Folder Path
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
                placeholder="/path/to/your/project"
                className="flex-1 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-strong transition-colors"
              />
              <button
                type="button"
                onClick={handleOpenBrowser}
                className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-text-primary hover:bg-bg-component-hover transition-colors"
                title="Browse folders"
              >
                <FolderOpen className="h-4 w-4" />
              </button>
            </div>

            {/* Inline Folder Browser */}
            {showBrowser && (
              <div className="rounded-md border border-border-subtle bg-bg-elevated overflow-hidden mt-2">
                {/* Browser header with current path */}
                <div className="flex items-center gap-1 border-b border-border-subtle bg-bg-app px-3 py-2">
                  {browseParent && (
                    <button
                      onClick={() => void browseTo(browseParent)}
                      className="rounded p-1 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                      title="Go up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span className="text-[11px] text-text-muted truncate flex-1 font-mono">
                    {browsePath}
                  </span>
                  <button
                    onClick={() => handleSelectFolder(browsePath)}
                    className="rounded-md px-2 py-1 text-[10px] font-medium bg-text-primary text-bg-surface hover:opacity-90 transition-colors"
                  >
                    Select This Folder
                  </button>
                </div>
                {/* Directory listing */}
                <div className="max-h-48 overflow-y-auto scrollbar-elegant">
                  {browseLoading ? (
                    <div className="flex items-center justify-center py-6 text-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : browseEntries.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-text-muted">
                      No subdirectories
                    </div>
                  ) : (
                    browseEntries.map((entry) => (
                      <button
                        key={entry.path}
                        onClick={() => void browseTo(entry.path)}
                        onDoubleClick={() => handleSelectFolder(entry.path)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-state-hover transition-colors"
                      >
                        <Folder className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                        <span className="truncate">{entry.name}</span>
                        <ChevronRight className="h-3 w-3 text-text-muted ml-auto flex-shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Validation indicators */}
            {validating && (
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                Validating...
              </div>
            )}
            {!validating && validation.checked && (
              <div className={`flex items-center gap-1.5 text-[11px] ${validation.valid ? 'text-status-success-text' : 'text-status-error-text'}`}>
                {validation.valid ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {validation.valid ? 'Valid folder' : (validation.error || 'Invalid path')}
              </div>
            )}
            {!validating && gitValidation.checked && (
              <div className={`flex items-center gap-1.5 text-[11px] ${gitValidation.valid ? 'text-status-success-text' : 'text-text-muted'}`}>
                {gitValidation.valid ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {gitValidation.valid
                  ? `Git repo (${gitValidation.currentBranch || 'detected'})`
                  : (gitValidation.error || 'Not a git repository')}
              </div>
            )}
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Display Name (optional)
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
              placeholder="Derived from folder name"
              className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-strong transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-state-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={!validation.valid || saving}
            className="rounded-md bg-text-primary px-3 py-1.5 text-xs font-medium text-bg-surface hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {saving ? 'Creating...' : 'Create Workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}
