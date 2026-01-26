import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
    node?: any;
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
    [key: string]: any;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children, ...props }) => {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');

    const handleCopy = () => {
        navigator.clipboard.writeText(codeString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (inline) {
        return (
            <code className="bg-zinc-800/50 px-1 py-0.5 rounded text-zinc-300 font-mono text-[10px]" {...props}>
                {children}
            </code>
        );
    }

    const lines = codeString.split('\n');
    const isSingleLine = lines.length <= 1;

    // Compact Mode for single line items (like filenames in agent output)
    if (isSingleLine && !inline) {
        return (
            <div className="group relative my-1 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-between pl-2 pr-1 py-1">
                <code className="text-[11px] font-mono text-zinc-300 overflow-x-auto whitespace-pre scrollbar-hide">
                    {codeString.replace(/[.,;]$/, '')}
                </code>
                <button
                    onClick={handleCopy}
                    className="ml-2 p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title="Copy"
                >
                    {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                </button>
            </div>
        );
    }

    // Full Code Block
    return (
        <div className="relative group my-3 rounded-md overflow-hidden border border-zinc-800 bg-zinc-900/50">
            {/* Header / Language Badge */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-500 lowercase">
                    {language || 'text'}
                </span>
                <button
                    onClick={handleCopy}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy code"
                >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
            </div>

            {/* Code Content */}
            <div className="text-[11px] [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-3">
                <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={language}
                    PreTag="div"
                    showLineNumbers={lines.length > 2} // Only show line numbers for 3+ lines
                    lineNumberStyle={{
                        minWidth: '2em',
                        paddingRight: '1em',
                        color: '#52525b', // zinc-600
                        textAlign: 'right',
                    }}
                    customStyle={{
                        background: 'transparent',
                        margin: 0,
                    }}
                >
                    {codeString}
                </SyntaxHighlighter>
            </div>
        </div>
    );
};

export default CodeBlock;
