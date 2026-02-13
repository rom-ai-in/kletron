'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Folder, AlertCircle, Check, Loader2, X } from 'lucide-react';

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

  // Reset all state when modal opens (fix #12: reset on open, not after close)
  useEffect(() => {
    if (open) {
      setRootPath('');
      setName('');
      setValidating(false);
      setValidation(INITIAL_VALIDATION);
      setGitValidation(INITIAL_GIT_VALIDATION);
      setSaving(false);
      setError(null);
      // Auto-focus the path input after a tick (fix #6)
      requestAnimationFrame(() => {
        pathInputRef.current?.focus();
      });
    }
  }, [open]);

  // Escape key handler (fix #6)
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
        // Also check git
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
      // Auto-derive name from path
      if (!name.trim()) {
        const parts = rootPath.trim().split('/').filter(Boolean);
        const derived = parts[parts.length - 1] || '';
        setName(derived);
      }
    }
  }, [rootPath, name, validatePath]);

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
      onClick={onClose} // Fix #6: backdrop click closes modal
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border-subtle bg-bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()} // Prevent backdrop close when clicking inside
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
            <input
              ref={pathInputRef}
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              onBlur={handlePathBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePathBlur();
              }}
              placeholder="/path/to/your/project"
              className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-strong transition-colors"
            />
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
                // Fix #6: Enter on name field submits the form
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
