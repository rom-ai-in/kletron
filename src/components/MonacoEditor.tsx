import React, { useRef } from 'react';
import Editor, { DiffEditor, OnMount } from '@monaco-editor/react';
import { useTheme } from '../hooks/useTheme';

interface MonacoEditorWrapperProps {
    filePath: string;
    initialContent: string;
    originalContent?: string;
    isDiff?: boolean;
    onSave: (content: string) => void;
    onChange?: (content: string) => void;
}

export const MonacoEditor: React.FC<MonacoEditorWrapperProps> = ({
    filePath,
    initialContent,
    originalContent = '',
    isDiff = false,
    onSave,
    onChange,
}) => {
    const { theme } = useTheme(); // "dark" | "light"
    const editorRef = useRef<any>(null);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        // Keybinding for Save (Ctrl+S / Cmd+S)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            const value = editor.getValue();
            onSave(value);
        });
    };

    const handleChange = (value: string | undefined) => {
        if (value !== undefined) {
            onChange?.(value);
        }
    };

    // Determine language based on file extension
    const getLanguage = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'ts': return 'typescript';
            case 'tsx': return 'typescript'; // Monaco handles TSX well with 'typescript' language usually, or 'javascript'
            case 'js': return 'javascript';
            case 'jsx': return 'javascript';
            case 'json': return 'json';
            case 'css': return 'css';
            case 'html': return 'html';
            case 'md': return 'markdown';
            default: return 'plaintext';
        }
    };

    return (
        <div className="h-full w-full overflow-hidden">
            {isDiff ? (
                <DiffEditor
                    height="100%"
                    original={originalContent}
                    modified={initialContent}
                    language={getLanguage(filePath)}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    options={{
                        minimap: { enabled: false },
                        renderSideBySide: true,
                        readOnly: true,
                        automaticLayout: true,
                        fontSize: 13,
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
                    }}
                />
            ) : (
                <Editor
                    height="100%"
                    path={filePath}
                    defaultLanguage={getLanguage(filePath)}
                    language={getLanguage(filePath)}
                    defaultValue={initialContent}
                    value={initialContent}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    onMount={handleEditorDidMount}
                    onChange={handleChange}
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 13,
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
                        automaticLayout: true,
                        wordWrap: 'on',
                    }}
                />
            )}
        </div>
    );
};
