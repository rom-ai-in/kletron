import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';

interface ThoughtsPanelProps {
    thoughts: string[];
    isReasoning?: boolean; // If it's pure "thinking" text vs discrete steps
}

export const ThoughtsPanel: React.FC<ThoughtsPanelProps> = ({ thoughts = [] }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!thoughts || thoughts.length === 0) return null;

    return (
        <div className="mb-1.5 border border-zinc-800 rounded-md overflow-hidden bg-zinc-900/30">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-zinc-800/30 transition-colors"
            >
                <div className="flex items-center justify-center w-4 h-4 rounded text-zinc-500">
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>
                <div className="flex items-center gap-2 text-zinc-500">
                    <Brain size={12} />
                    <span className="text-[10px] font-medium tracking-wide">
                        PROCESS ({thoughts.length} steps)
                    </span>
                </div>
            </button>

            {isExpanded && (
                <div className="px-2 pb-2 space-y-1">
                    {thoughts.map((step, idx) => (
                        <div key={idx} className="flex gap-3 text-[10px] group">
                            <div className="flex-shrink-0 mt-0.5 text-zinc-600">
                                <CheckCircle2 size={12} />
                            </div>
                            <div className="text-zinc-400 leading-tight font-mono">
                                {step}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
