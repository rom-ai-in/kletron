import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock'; // We will create this next

interface ToolOutputProps {
    output: string;
    isError?: boolean;
}

export const ToolOutput: React.FC<ToolOutputProps> = ({ output, isError }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // If output is short (e.g. less than 100 chars), show it inline? 
    // Actually Cursor usually shows a block. Let's default to a collapsed block if very long, or just scrollable.
    // Cursor style: A distinct block below the tool call.

    return (
        <div className="mt-2 text-[10px] font-mono border border-zinc-700/50 rounded-md overflow-hidden bg-zinc-900/50">
            <div
                className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/30 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-zinc-400">
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Terminal size={10} />
                    <span className="font-semibold tracking-wide uppercase text-[9px]">Output</span>
                    {isError && <span className="text-red-400 text-[9px]">(Error)</span>}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCopy();
                    }}
                    className="p-1 hover:bg-zinc-700/50 rounded transition-colors text-zinc-500 hover:text-zinc-300"
                    title="Copy output"
                >
                    {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                </button>
            </div>

            {isExpanded && (
                <div className="p-3 overflow-x-auto max-h-[300px] overflow-y-auto">
                    {/* Check if output looks like JSON, if so format it? For now raw text is usually safer for tools */}
                    <pre className={`whitespace-pre-wrap break-all ${isError ? 'text-red-300' : 'text-zinc-300'}`}>
                        {output}
                    </pre>
                </div>
            )}

            {!isExpanded && (
                <div className="px-3 py-1.5 text-zinc-500 truncate cursor-pointer" onClick={() => setIsExpanded(true)}>
                    {output.split('\n')[0].substring(0, 80)}
                    {output.length > 80 && '...'}
                </div>
            )}
        </div>
    );
};
