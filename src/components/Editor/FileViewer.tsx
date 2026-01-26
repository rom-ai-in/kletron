import React from 'react';
import { MonacoEditor } from '../MonacoEditor';
import { CursorLayer } from './CursorLayer';
import { useEditorState } from '../../context/EditorContext';

interface FileViewerProps {
    fileId: string;
    fileContent: string;
    savedContent: string;
    showDiff: boolean;
    onSave: (content: string) => void;
    onChange: (content: string) => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({
    fileId,
    fileContent,
    savedContent,
    showDiff,
    onSave,
    onChange
}) => {
    const { updateCursor } = useEditorState();
    const myAgentId = 'me'; // In a real app, this would be the current user's ID

    // We throttle cursor updates to avoid flooding the server
    const handleCursorChange = (position: { lineNumber: number, column: number }) => {
        // This would require lifting state from MonacoEditor or ref forwarding.
        // For now, we assume MonacoEditor tracks its own cursor but doesn't expose it easily via props.
        // We'll skip implementing the *outgoing* cursor updates for "me" in this iteration 
        // unless we modify MonacoEditor to expose onCursorPositionChange.
        // Let's assume we implement it later or add a listener if we had ref access.

        // updateCursor(fileId, myAgentId, { line: position.lineNumber, column: position.column });
    };

    return (
        <div className="relative h-full w-full">
            <MonacoEditor
                filePath={fileId}
                initialContent={fileContent}
                originalContent={savedContent}
                isDiff={showDiff}
                onSave={onSave}
                onChange={onChange}
            />
            {/* Remote Cursors Overlay */}
            {!showDiff && <CursorLayer fileId={fileId} />}
        </div>
    );
};
