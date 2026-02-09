'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export interface LineHighlight {
    line: number;
    className: string;
}

export interface CodeEditorProps {
    value: string;
    language?: string;
    filename?: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    theme?: 'numezis-dark' | 'numezis-light';
    minimap?: boolean;
    lineNumbers?: boolean;
    wordWrap?: 'on' | 'off';
    highlights?: LineHighlight[];
    onSave?: (value: string) => void;
    className?: string;
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
    swift: 'swift', kt: 'kotlin', scala: 'scala',
    html: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
    xml: 'xml', svg: 'xml',
    md: 'markdown', mdx: 'markdown',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    sql: 'sql', graphql: 'graphql',
    dockerfile: 'dockerfile',
    vue: 'html', svelte: 'html',
    lua: 'lua', php: 'php', r: 'r', dart: 'dart',
};

export function detectLanguage(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower === 'dockerfile') return 'dockerfile';
    if (lower === 'makefile') return 'makefile';
    if (lower.endsWith('.env') || lower.startsWith('.env')) return 'plaintext';
    const ext = lower.split('.').pop() || '';
    return EXTENSION_LANGUAGE_MAP[ext] || 'plaintext';
}

/**
 * Monaco theme colors sourced from design system rawColors.
 * Monaco's defineTheme API requires hex values (not CSS variables),
 * so we use the canonical raw values from the token system.
 */
const monacoThemeColors = {
    dark: {
        'editor.background': '#09090b',       // rawColors.bgApp
        'editor.foreground': '#e4e4e7',       // rawColors.primary
        'editor.lineHighlightBackground': '#18181b', // rawColors.bgSurface
        'editor.selectionBackground': '#3f3f4640',   // zinc-700 @ 25%
        'editorLineNumber.foreground': '#52525b',     // zinc-600
        'editorLineNumber.activeForeground': '#a1a1aa', // rawColors.secondary
        'editor.inactiveSelectionBackground': '#27272a40', // rawColors.bgElevated @ 25%
        'editorIndentGuide.background': '#27272a',    // rawColors.bgElevated
        'editorCursor.foreground': '#3994BC',          // rawColors.accent
        'minimap.background': '#09090b',               // rawColors.bgApp
        'editorGutter.addedBackground': '#72C892',     // rawColors.gutterAdded
        'editorGutter.deletedBackground': '#F28772',   // rawColors.gutterDeleted
        'editorGutter.modifiedBackground': '#e5ba7d',  // rawColors.gitModified
        'diffEditor.insertedTextBackground': '#72C89233', // rawColors.diffInserted
        'diffEditor.removedTextBackground': '#F2877233',  // rawColors.diffRemoved
    },
    light: {
        'editor.background': '#ffffff',
        'editor.foreground': '#18181b',       // rawColors.bgSurface (inverted)
        'editor.lineHighlightBackground': '#f4f4f5',
        'editor.selectionBackground': '#dbeafe60',
        'editorLineNumber.foreground': '#a1a1aa',      // rawColors.secondary
        'editorLineNumber.activeForeground': '#52525b',
        'editorCursor.foreground': '#3994BC',           // rawColors.accent
    },
} as const;

function defineNumezisThemes(monaco: any) {
    monaco.editor.defineTheme('numezis-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'c084fc' },
            { token: 'string', foreground: '34d399' },
            { token: 'number', foreground: 'fbbf24' },
            { token: 'type', foreground: '38bdf8' },
        ],
        colors: monacoThemeColors.dark,
    });

    monaco.editor.defineTheme('numezis-light', {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '9ca3af', fontStyle: 'italic' },
            { token: 'keyword', foreground: '7c3aed' },
            { token: 'string', foreground: '059669' },
            { token: 'number', foreground: 'd97706' },
            { token: 'type', foreground: '0284c7' },
        ],
        colors: monacoThemeColors.light,
    });
}

export function CodeEditor({
    value,
    language,
    filename,
    onChange,
    readOnly = false,
    theme = 'numezis-dark',
    minimap = true,
    lineNumbers = true,
    wordWrap = 'off',
    highlights,
    onSave,
    className = '',
}: CodeEditorProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const decorationsRef = useRef<string[]>([]);
    const resolvedLanguage = language || (filename ? detectLanguage(filename) : 'plaintext');

    const handleMount: OnMount = useCallback((editor, monaco) => {
        editorRef.current = editor;
        defineNumezisThemes(monaco);
        monaco.editor.setTheme(theme);

        // Cmd+S / Ctrl+S
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            const currentValue = editor.getValue();
            onSave?.(currentValue);
        });
    }, [theme, onSave]);

    // Apply line highlights via Monaco decorations
    useEffect(() => {
        if (!editorRef.current || !highlights?.length) {
            if (editorRef.current && decorationsRef.current.length > 0) {
                decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
            }
            return;
        }
        const decorations = highlights.map(h => ({
            range: { startLineNumber: h.line, startColumn: 1, endLineNumber: h.line, endColumn: 1 },
            options: { isWholeLine: true, className: h.className },
        }));
        decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, decorations);
    }, [highlights]);

    const handleChange: OnChange = useCallback((value) => {
        onChange?.(value ?? '');
    }, [onChange]);

    return (
        <div className={`h-full w-full ${className}`}>
            <Editor
                value={value}
                language={resolvedLanguage}
                theme={theme}
                onChange={handleChange}
                onMount={handleMount}
                options={{
                    readOnly,
                    minimap: { enabled: minimap },
                    lineNumbers: lineNumbers ? 'on' : 'off',
                    wordWrap,
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                    fontLigatures: true,
                    tabSize: 2,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 8, bottom: 8 },
                    renderLineHighlight: 'line',
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    bracketPairColorization: { enabled: true },
                }}
            />
        </div>
    );
}
