/**
 * Numezis Design System - Shared Monaco Editor Themes
 *
 * Canonical Monaco theme definitions sourced from design tokens.
 * Monaco's defineTheme API requires hex values (not CSS variables),
 * so we use the raw token values.
 *
 * @example
 * import { defineNumezisThemes, monacoThemeColors } from '@numezis/ui/styles/monaco-themes';
 * // In your Monaco onMount handler:
 * defineNumezisThemes(monaco);
 * monaco.editor.setTheme('numezis-dark');
 */

import { rawColors } from '../tokens/colors';

export const monacoThemeColors = {
    dark: {
        'editor.background': rawColors.bgApp,
        'editor.foreground': rawColors.primary,
        'editor.lineHighlightBackground': rawColors.bgSurface,
        'editor.selectionBackground': '#3f3f4640',
        'editorLineNumber.foreground': '#52525b',
        'editorLineNumber.activeForeground': rawColors.secondary,
        'editor.inactiveSelectionBackground': `${rawColors.bgElevated}40`,
        'editorIndentGuide.background': rawColors.bgElevated,
        'editorCursor.foreground': rawColors.accent,
        'minimap.background': rawColors.bgApp,
        'editorGutter.addedBackground': rawColors.gutterAdded,
        'editorGutter.deletedBackground': rawColors.gutterDeleted,
        'editorGutter.modifiedBackground': rawColors.gitModified,
        'diffEditor.insertedTextBackground': rawColors.diffInserted,
        'diffEditor.removedTextBackground': rawColors.diffRemoved,
    },
    light: {
        'editor.background': '#ffffff',
        'editor.foreground': rawColors.bgSurface,
        'editor.lineHighlightBackground': '#f4f4f5',
        'editor.selectionBackground': '#dbeafe60',
        'editorLineNumber.foreground': rawColors.secondary,
        'editorLineNumber.activeForeground': '#52525b',
        'editorCursor.foreground': rawColors.accent,
    },
} as const;

export const monacoTokenRules = {
    dark: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc' },
        { token: 'string', foreground: '34d399' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'type', foreground: '38bdf8' },
    ],
    light: [
        { token: 'comment', foreground: '9ca3af', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7c3aed' },
        { token: 'string', foreground: '059669' },
        { token: 'number', foreground: 'd97706' },
        { token: 'type', foreground: '0284c7' },
    ],
} as const;

/**
 * Register Numezis themes in Monaco.
 * Call this in your Monaco `onMount` handler.
 */
export function defineNumezisThemes(monaco: any) {
    monaco.editor.defineTheme('numezis-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [...monacoTokenRules.dark],
        colors: { ...monacoThemeColors.dark },
    });

    monaco.editor.defineTheme('numezis-light', {
        base: 'vs',
        inherit: true,
        rules: [...monacoTokenRules.light],
        colors: { ...monacoThemeColors.light },
    });
}
