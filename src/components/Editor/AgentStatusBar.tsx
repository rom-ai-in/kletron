import React from 'react';
import { useEditorState } from '../../context/EditorContext';
import { AlertCircle, CheckCircle, Activity } from 'lucide-react';

export const AgentStatusBar: React.FC = () => {
    const { state } = useEditorState();
    const activeAgentCount = Object.keys(state.cursors).length;
    const pendingDiffCount = Object.values(state.pendingDiffs).flat().length;
    // @ts-ignore
    const conflicts = Object.values(state.pendingDiffs).flat().filter(d => d.status === 'conflict').length;

    return (
        <div className="h-6 bg-blue-950/20 border-t border-border-subtle flex items-center px-2 py-0.5 justify-between text-[10px] text-text-muted select-none">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>{activeAgentCount} Active Agents</span>
                </div>
                {pendingDiffCount > 0 && (
                    <div className="flex items-center gap-1 text-blue-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span>{pendingDiffCount} Pending Diffs</span>
                    </div>
                )}
            </div>

            {conflicts > 0 && (
                <div className="flex items-center gap-1 text-red-400 font-bold animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    <span>{conflicts} CONSTRAINT CONFLICTS DETECTED</span>
                </div>
            )}
        </div>
    );
};
