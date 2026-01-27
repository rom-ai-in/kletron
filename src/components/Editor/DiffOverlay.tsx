import React, { useMemo } from 'react';
import { useEditorState } from '../../context/EditorContext';
import { AgentDiff } from '../../types/editor';
import { Check, X, AlertTriangle, ListFilter, Trash2 } from 'lucide-react';

interface DiffOverlayProps {
    fileId: string;
}

export const DiffOverlay: React.FC<DiffOverlayProps> = ({ fileId }) => {
    const { state, commitDiff } = useEditorState();
    const diffs = state.pendingDiffs[fileId] || [];

    // Group by Agent
    const groupedDiffs = useMemo(() => {
        const groups: Record<string, AgentDiff[]> = {};
        diffs.forEach(d => {
            if (!groups[d.agentId]) groups[d.agentId] = [];
            groups[d.agentId].push(d);
        });
        return groups;
    }, [diffs]);

    if (diffs.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center">
                    <Check className="w-5 h-5 text-zinc-600" />
                </div>
                <div>
                    <p className="font-medium text-text-primary">All Clear</p>
                    <p className="opacity-70 mt-1">No pending changes to review.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-bg-surface">
            {/* Report Header */}
            <div className="flex-shrink-0 p-3 border-b border-border-subtle bg-bg-elevated/50 backdrop-blur">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide flex items-center gap-2">
                        <ListFilter size={12} />
                        Traceability Report
                    </h3>
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                        {diffs.length} Pending
                    </span>
                </div>

                {/* Bulk Actions */}
                <div className="flex gap-2">
                    <button className="flex-1 py-1 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-medium transition-colors flex items-center justify-center gap-1">
                        <Check size={10} /> Accept All
                    </button>
                    <button className="flex-1 py-1 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-[10px] font-medium transition-colors flex items-center justify-center gap-1">
                        <Trash2 size={10} /> Reject All
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {Object.entries(groupedDiffs).map(([agentId, agentDiffs]) => (
                    <div key={agentId} className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{agentId}</span>
                        </div>
                        <div className="space-y-2 pl-2 border-l border-zinc-800 ml-0.5">
                            {agentDiffs.map(diff => (
                                <DiffCard key={diff.id} diff={diff} onCommit={() => commitDiff(fileId, diff.agentId, diff.id)} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DiffCard: React.FC<{ diff: AgentDiff, onCommit: () => void }> = ({ diff, onCommit }) => {
    const isConflict = diff.status === 'conflict';

    return (
        <div className={`group relative rounded-md border ${isConflict ? 'border-red-500/50 bg-red-900/10' : 'border-border-subtle bg-bg-app hover:border-zinc-600'} text-xs overflow-hidden transition-all shadow-sm`}>
            {/* Header */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border-subtle/50 bg-zinc-900/40">
                <span className="font-mono text-[10px] text-zinc-500 flex items-center gap-1">
                    <span>Lines {diff.chunks[0]?.startLine}-{diff.chunks[diff.chunks.length - 1]?.endLine}</span>
                </span>
                <span className="text-[9px] text-zinc-600 font-mono">
                    {new Date(diff.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            {/* Chunks */}
            <div className="p-2 space-y-1">
                {diff.chunks.map((chunk, i) => (
                    <div key={i} className="font-mono text-[11px] leading-relaxed">
                        {/* Deletions */}
                        {chunk.originalContent && chunk.originalContent.length > 0 && chunk.originalContent.map((line, idx) => (
                            <div key={`del-${idx}`} className="flex text-red-400/50 decoration-red-500/30 line-through">
                                <span className="select-none text-zinc-700 w-4 text-center mr-1">-</span>
                                <span>{line}</span>
                            </div>
                        ))}
                        {/* Additions */}
                        {chunk.replacementContent && chunk.replacementContent.map((line, idx) => (
                            <div key={`add-${idx}`} className="flex text-emerald-400/90">
                                <span className="select-none text-emerald-900 w-4 text-center mr-1">+</span>
                                <span>{line}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Hover Actions */}
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-zinc-900 rounded border border-zinc-700 p-0.5 shadow-xl transform scale-95 hover:scale-100">
                <button
                    onClick={onCommit}
                    disabled={isConflict}
                    title="Accept (Tab)"
                    className="p-1 hover:bg-emerald-500/20 text-emerald-500 rounded"
                >
                    <Check size={12} />
                </button>
                <button
                    // onClick={} // Todo: Reject
                    title="Reject (Esc)"
                    className="p-1 hover:bg-red-500/20 text-red-500 rounded"
                >
                    <X size={12} />
                </button>
            </div>

            {/* Status Footer if Conflict */}
            {isConflict && (
                <div className="bg-red-500/10 text-red-400 px-2 py-1 text-[10px] flex items-center gap-1 font-medium">
                    <AlertTriangle size={10} /> Merge Conflict
                </div>
            )}
        </div>
    );
};
