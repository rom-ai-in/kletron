import React, { useState, useMemo } from 'react';
import { MonacoEditor } from '../MonacoEditor';
import { CursorLayer } from './CursorLayer';
import { DocumentViewer } from './DocumentViewer';
import { useEditorState } from '../../context/EditorContext';
import { useGhostText } from '../../hooks/useGhostText';
import { getFileViewerType } from '@/src/utils/fileTypes';

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
    const { updateCursor, state, commitDiff } = useEditorState();
    const [editorInstance, setEditorInstance] = useState<any>(null); // Store editor instance

    // Determine viewer type based on file extension
    const viewerType = useMemo(() => getFileViewerType(fileId), [fileId]);

    // Get pending diffs for this file
    const pendingDiffs = state.pendingDiffs[fileId] || [];

    // Correct handler:
    const handleAcceptDiff = (diffId: string) => {
        const diff = pendingDiffs.find(d => d.id === diffId);
        if (diff) {
            commitDiff(fileId, diff.agentId, diffId);
        }
    };

    // Enable Ghost Text
    useGhostText(editorInstance, pendingDiffs, handleAcceptDiff, (id) => {
        console.log('Rejected diff', id);
        // todo: implement reject logic in context
    });


    const myAgentId = 'me';

    const handleCursorChange = (position: { lineNumber: number, column: number }) => {
        // ... implementation pending
    };

    // Route to appropriate viewer based on file type
    if (viewerType === 'document') {
        return (
            <div className="relative h-full w-full">
                <DocumentViewer filePath={fileId} />
            </div>
        );
    }

    // Default: Monaco editor for text/code files
    return (
        <div className="relative h-full w-full">
            <MonacoEditor
                filePath={fileId}
                initialContent={fileContent}
                originalContent={savedContent}
                isDiff={showDiff}
                onSave={onSave}
                onChange={onChange}
                onMount={(editor) => setEditorInstance(editor)}
            />
            {/* Remote Cursors Overlay */}
            {!showDiff && <CursorLayer fileId={fileId} />}
        </div>
    );
};
