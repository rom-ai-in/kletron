'use client';

import React, { useCallback, useRef } from 'react';
import { DiffEditor as MonacoDiffEditor, type DiffOnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { detectLanguage } from './CodeEditor';

export interface DiffEditorProps {
    original: string;
    modified: string;
    language?: string;
    filename?: string;
    renderSideBySide?: boolean;
    readOnly?: boolean;
    onAccept?: () => void;
    onReject?: () => void;
    theme?: 'kletron-dark' | 'kletron-light';
    className?: string;
}

export function DiffEditorComponent({
    original,
    modified,
    language,
    filename,
    renderSideBySide = true,
    readOnly = true,
    onAccept,
    onReject,
    theme = 'kletron-dark',
    className = '',
}: DiffEditorProps) {
    const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
    const resolvedLanguage = language || (filename ? detectLanguage(filename) : 'plaintext');

    const handleMount: DiffOnMount = useCallback((editor) => {
        editorRef.current = editor;
    }, []);

    return (
        <div className={`flex h-full w-full flex-col ${className}`}>
            {(onAccept || onReject) && (
                <div className="flex items-center justify-end gap-2 border-b border-border-subtle bg-bg-app px-3 py-1.5">
                    {onReject && (
                        <button
                            type="button"
                            onClick={onReject}
                            className="rounded-md border border-border-subtle px-3 py-1 text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary transition-colors"
                        >
                            Reject
                        </button>
                    )}
                    {onAccept && (
                        <button
                            type="button"
                            onClick={onAccept}
                            className="rounded-md border border-status-success-border bg-status-success-bg px-3 py-1 text-xs text-status-success-text hover:bg-status-success-bg transition-colors"
                        >
                            Accept
                        </button>
                    )}
                </div>
            )}
            <div className="flex-1">
                <MonacoDiffEditor
                    original={original}
                    modified={modified}
                    language={resolvedLanguage}
                    theme={theme}
                    onMount={handleMount}
                    options={{
                        readOnly,
                        renderSideBySide,
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
                        fontLigatures: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 8, bottom: 8 },
                        renderOverviewRuler: false,
                        diffWordWrap: 'off',
                    }}
                />
            </div>
        </div>
    );
}

export { DiffEditorComponent as DiffEditor };
