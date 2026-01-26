import React from 'react';
import { useEditorState } from '../../context/EditorContext';

interface CursorLayerProps {
    fileId: string;
    lineHeight?: number; // pass this if we need pixel perfect positioning, else use percentage or line number approximation
}

export const CursorLayer: React.FC<CursorLayerProps> = ({ fileId }) => {
    const { state } = useEditorState();

    // Filter cursors for this file
    const fileCursors = Object.values(state.cursors).filter(c => c.fileId === fileId);

    if (fileCursors.length === 0) return null;

    // NOTE: This layer sits on top of Monaco. Positioning exactly on lines is hard without access to Monaco's internal layout info.
    // A better approach for Monaco is to use `editor.deltaDecorations` API.
    // However, since we are wrapping Monaco in a functional component without easy access to the instance yet (unless we refactor),
    // we might render a simple floating list for now, or accept that this simple implementation 
    // just shows "WHO is here" rather than "EXACTLY WHERE" until we hook into Monaco instance.

    // FOR THIS ITERATION: We will implement this as a purely visual "active agents" list floating near top right,
    // because overlaying DOM elements exactly over Monaco lines requires the Monaco instance.
    // We will leave a TODO to integrate with Monaco decorations in `FileViewer`.

    return (
        <div className="absolute top-2 right-4 flex flex-col gap-1 pointer-events-none z-10">
            {fileCursors.map(cursor => (
                <div key={cursor.agentId} className="flex items-center gap-1 bg-bg-surface/80 backdrop-blur px-2 py-1 rounded border border-border-subtle shadow-sm animate-in fade-in zoom-in duration-200">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cursor.color || '#10b981' }} />
                    <span className="text-xs text-text-primary font-mono">
                        {cursor.label || cursor.agentId} L{cursor.position.line}
                    </span>
                </div>
            ))}
        </div>
    );
};
