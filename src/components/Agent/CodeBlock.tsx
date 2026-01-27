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
            <span className="bg-zinc-800/50 border border-zinc-700/30 px-1.5 py-0.5 rounded text-zinc-300 font-mono text-[11px] inline-block max-w-full overflow-x-auto scrollbar-hide align-middle mx-0.5 my-0.5">
                {codeString.replace(/[.,;]$/, '')}
            </span>
        );
    }

    // Full Code Block
    return (
        <div className="relative group my-1 rounded-md overflow-hidden border border-zinc-800 bg-zinc-900/50">
            {/* Header / Language Badge */}
            <div className="flex items-center justify-between px-2.5 py-1 bg-zinc-900/80 border-b border-zinc-800">
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
            <div className="text-[11px] [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-2">

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
