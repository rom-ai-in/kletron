import { useEffect, useRef, useCallback } from 'react';
import { AgentDiff } from '../types/editor';

// We need some Monaco types. Since we don't have the package installed in this context file easily without import,
// we'll assume `any` for the editor instance or rely on generic types passed in, 
// but in a real codebase we'd import { editor } from 'monaco-editor'.
// For this environment, we use `any` to avoid TS build errors if type defs aren't perfect in the env.

export const useGhostText = (
    editor: any,
    diffs: AgentDiff[],
    onAccept: (diffId: string) => void,
    onReject: (diffId: string) => void
) => {
    const decorationsCollectionRef = useRef<any>(null); // editor.createDecorationsCollection()
    const viewZoneIdsRef = useRef<string[]>([]);

    // Cleanup function to remove all ghost text artifacts
    const clearGhostText = useCallback(() => {
        if (editor) {
            // Clear decorations
            if (decorationsCollectionRef.current) {
                decorationsCollectionRef.current.clear();
            }
            // Clear view zones
            editor.changeViewZones((changeAccessor: any) => {
                viewZoneIdsRef.current.forEach(id => changeAccessor.removeZone(id));
            });
            viewZoneIdsRef.current = [];
        }
    }, [editor]);

    // Main Effect: Render Diffs
    useEffect(() => {
        if (!editor || !diffs) return;

        // 1. Clear previous
        clearGhostText();

        const newDecorations: any[] = [];
        const newViewZones: any[] = [];

        // 2. Iterate diffs
        diffs.forEach(diff => {
            if (diff.status !== 'pending') return;

            diff.chunks.forEach(chunk => {
                // HANDLE DELETIONS / MODIFICATIONS (The "Old" Layout)
                // If there is original content (lines to be removed/changed), strike them out
                // We use endLine >= startLine to verify it's not a pure insertion
                // Actually, standard diff chunks usually have start/end. 
                // A pure insertion often has startLine=X, endLine=X-1 or similar in some diff tools, 
                // but let's assume if originalContent is present, we decorate.

                // NOTE: Git diffs often give startLine/endLine for the "original" file. 
                // We assume the editor content MATCHES the "original" (pre-edit) state currently.

                if (chunk.endLine >= chunk.startLine) {
                    // It covers existing lines. Mark them as "to be deleted".
                    // But wait, if it's a replacement, we want to see the old text with strikethrough.
                    if (chunk.originalContent) {
                        newDecorations.push({
                            range: {
                                startLineNumber: chunk.startLine,
                                startColumn: 1,
                                endLineNumber: chunk.endLine,
                                endColumn: 1000 // encompass whole line
                            },
                            options: {
                                isWholeLine: true,
                                className: 'line-through opacity-40 text-red-400 decoration-red-500/50', // Tailwind classes depend on Monaco's capability to use them, or standard CSS classes injected globally
                                inlineClassName: 'opacity-50',
                                description: 'pending-rejection'
                            }
                        });
                    }
                }

                // HANDLE ADDITIONS (The "New" Layout - Ghost Text)
                if (chunk.replacementContent && chunk.replacementContent.length > 0) {
                    // Create a ViewZone to insert *after* the insertion point.
                    // If it's a replacement, we insert after the last line of the replaced set.
                    // If it's a pure insert, startLine might be the line *after* which we insert.

                    const afterLineNumber = chunk.endLine; // We render *below* the target block (ghost text follows)

                    const domNode = document.createElement('div');
                    domNode.className = 'ghost-text-block font-mono text-sm';
                    domNode.style.backgroundColor = 'rgba(30, 41, 59, 0.5)'; // zinc-800 with opacity
                    domNode.style.width = '100%';
                    domNode.style.paddingLeft = '50px'; // Approx padding for line numbers, hardcoded for now or measured? 
                    // Actually Monaco handles margin. We just need to pad content if we are overlaying.
                    // ViewZone contents are usually inside the editor content area.

                    // Render lines
                    chunk.replacementContent.forEach(line => {
                        const lineNode = document.createElement('div');
                        lineNode.textContent = line; // Use pre for preservation?
                        lineNode.style.color = '#9ca3af'; // gray-400
                        lineNode.className = 'whitespace-pre';
                        domNode.appendChild(lineNode);
                    });

                    newViewZones.push({
                        afterLineNumber: afterLineNumber,
                        heightInLines: chunk.replacementContent.length,
                        domNode: domNode,
                        suppressMouseDown: true // Let clicks pass through? Or maybe we want to click to accept?
                    });
                }
            });
        });

        // 3. Apply Decorations
        if (editor.createDecorationsCollection) {
            decorationsCollectionRef.current = editor.createDecorationsCollection(newDecorations);
        } else {
            // Fallback for older Monaco versions if needed, but standard is createDecorationsCollection now
            // decorationsCollectionRef.current = editor.deltaDecorations([], newDecorations); 
        }

        // 4. Apply ViewZones
        editor.changeViewZones((changeAccessor: any) => {
            newViewZones.forEach(vz => {
                const id = changeAccessor.addZone(vz);
                viewZoneIdsRef.current.push(id);
            });
        });

    }, [editor, diffs, clearGhostText]);

    // Handle Keybinding (Tab to Accept)
    useEffect(() => {
        if (!editor) return;

        // Add Command: Tab
        // We need to be careful not to break standard Tab if no diff is present.
        // `editor.addCommand` adds a global command for that editor instance.
        // We can check context inside the callback.

        const disposable = editor.addCommand(9, () => { // 9 is KeyCode.Tab (checking monaco enums)
            // Check if cursor is near a diff
            const position = editor.getPosition();
            if (!position) return;

            // Find nearest pending diff
            const activeDiff = diffs.find(d => {
                // Simple proximity check: inside or adjacent to a chunk
                return d.chunks.some(c =>
                    position.lineNumber >= c.startLine - 1 &&
                    position.lineNumber <= c.endLine + 1
                );
            });

            if (activeDiff) {
                // ACCEPT
                onAccept(activeDiff.id);
                // Flash feedback? handled by React re-render usually
            } else {
                // Pass through... how?
                // In Monaco, if you consume the event in addCommand, it stops.
                // To "pass through", we shouldn't have suppressed it. 
                // But `addCommand` consumes it.
                // TRIGGER DEFAULT TAB: `editor.trigger('keyboard', 'tab', null)` might cause infinite loop.
                // Correct way: Use `addCommand` with a ContextKey condition (precondition).
                // OR: Use `editor.onKeyDown` to intercept.

                editor.trigger('keyboard', 'type', { text: '\t' }); // Naive tab emulation
            }
        });

        // BETTER APPROACH: Keybinding with Precondition
        // But we can't easily set context keys dynamically from here without ContextKeyService.
        // Let's stick to `onKeyDown` which is safer for conditional logic, 
        // OR just `addCommand` and manual trigger.
        // Actually, `Tab` is complex (indentation vs insertion).
        // Let's try to find an existing command handler for "accept" (e.g. standard GhostText uses "Tab").
        // For our MVP, let's use a explicit "Accept" command on a custom key or overrides.
        // Overriding Tab is high-stakes.

        // KeyDown Handler
        const keyDownListener = editor.onKeyDown((e: any) => {
            const position = editor.getPosition();
            if (!position) return;

            // Find nearest pending diff (proximity check)
            const activeDiff = diffs.find(d => d.chunks.some(c =>
                position.lineNumber >= c.startLine - 2 &&
                position.lineNumber <= c.endLine + 5
            ));

            if (e.code === 'Tab') {
                if (activeDiff) {
                    e.preventDefault();
                    e.stopPropagation();
                    onAccept(activeDiff.id);
                }
            } else if (e.code === 'Escape') {
                // Reject logic
                if (activeDiff) {
                    e.preventDefault();
                    e.stopPropagation();
                    onReject(activeDiff.id);
                }
            }
        });

        return () => {
            keyDownListener.dispose();
            // disposable.dispose();
        };

    }, [editor, diffs, onAccept, onReject]);

    return { clearGhostText };
};
