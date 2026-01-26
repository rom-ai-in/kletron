import React from 'react';
import { useEditorState } from '../../context/EditorContext';
import { User, Users } from 'lucide-react';

interface FileTabsProps {
    currentFile: string;
}

export const FileTabs: React.FC<FileTabsProps> = ({ currentFile }) => {
    const { state, getAgentsForFile } = useEditorState();

    // We only show one tab for the current file in this simplified version, 
    // or maybe list open files. The existing UI shows just the selected file name.
    // Let's enhance the header to show active agents.

    if (!currentFile) return null;

    const agents = getAgentsForFile(currentFile);

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted truncate flex items-center">
                {currentFile}
            </span>
            {agents.length > 0 && (
                <div className="flex items-center gap-1 bg-bg-app px-2 py-0.5 rounded-full border border-border-subtle">
                    <Users className="w-3 h-3 text-emerald-500" />
                    <span className="text-xs text-text-primary">{agents.length} Agent{agents.length > 1 ? 's' : ''}</span>
                </div>
            )}
        </div>
    );
};
