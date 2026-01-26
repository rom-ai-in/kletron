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

        <div className="relative group">
            <div className="p-3 overflow-x-auto max-h-[400px] overflow-y-auto bg-zinc-950/50">
                <pre className={`whitespace-pre-wrap break-all font-mono text-[10px] ${isError ? 'text-red-300' : 'text-zinc-300'}`}>
                    {output}
                </pre>
            </div>
            <button
                onClick={() => {
                    navigator.clipboard.writeText(output);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }}
                className="absolute top-2 right-2 p-1.5 bg-zinc-800/80 hover:bg-zinc-700/80 rounded opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white"
                title="Copy output"
            >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
        </div>
    );
};
