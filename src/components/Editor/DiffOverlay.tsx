import React from 'react';
import { useEditorState } from '../../context/EditorContext';
import { AgentDiff } from '../../types/editor';
import { Check, X, AlertTriangle } from 'lucide-react';

interface DiffOverlayProps {
    fileId: string;
}

export const DiffOverlay: React.FC<DiffOverlayProps> = ({ fileId }) => {
    const { state, commitDiff } = useEditorState();
    const diffs = state.pendingDiffs[fileId] || [];

    if (diffs.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-text-muted text-xs p-4 text-center">
                No pending changes from agents
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-2 space-y-2">
                {diffs.map(diff => (
                    <DiffCard key={diff.id} diff={diff} onCommit={() => commitDiff(fileId, diff.agentId, diff.id)} />
                ))}
            </div>
        </div>
    );
};

const DiffCard: React.FC<{ diff: AgentDiff, onCommit: () => void }> = ({ diff, onCommit }) => {
    const isConflict = diff.status === 'conflict';

    return (
        <div className={`rounded border ${isConflict ? 'border-red-500/50 bg-red-900/10' : 'border-border-subtle bg-bg-surface'} p-2 text-xs flex flex-col gap-2 transition-all`}>
            {/* Header */}
            <div className="flex items-center justify-between pb-1 border-b border-border-subtle/50">
                <span className={`font-mono font-bold ${isConflict ? 'text-red-400' : 'text-emerald-400'}`}>
                    {diff.agentId}
                </span>
                <span className="text-[10px] text-text-muted">
                    {new Date(diff.timestamp).toLocaleTimeString()}
                </span>
            </div>

            {/* Chunks */}
            <div className="space-y-1 my-1">
                {diff.chunks.map((chunk, i) => (
                    <div key={i} className="font-mono bg-bg-app p-1 rounded">
                        <div className="text-text-muted mb-1 border-b border-white/5 pb-0.5">
                            Lines {chunk.startLine}-{chunk.endLine}
                        </div>
                        {chunk.replacementContent && chunk.replacementContent.length > 0 ? (
                            chunk.replacementContent.map((line, idx) => (
                                <div key={idx} className="text-emerald-300/90 whitespace-pre overflow-x-auto">
                                    + {line}
                                </div>
                            ))
                        ) : (
                            <div className="text-red-300/70 italic opacity-50">
                                Declared deletion
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
                <button
                    onClick={onCommit}
                    disabled={isConflict}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 rounded ${isConflict
                            ? 'bg-red-500/10 text-red-400 cursor-not-allowed'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                >
                    {isConflict ? <AlertTriangle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                    {isConflict ? 'Conflict' : 'Approve'}
                </button>
            </div>
        </div>
    );
};
