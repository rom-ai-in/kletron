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

    return (
        <div className="relative group my-3 rounded-md overflow-hidden border border-zinc-700/50 bg-[#1e1e1e]">
            {/* Header / Language Badge */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/50 border-b border-zinc-700/30">
                <span className="text-[9px] font-mono text-zinc-400 lowercase">
                    {language || 'text'}
                </span>
                <button
                    onClick={handleCopy}
                    className="p-1 hover:bg-zinc-700/50 rounded transition-colors text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy code"
                >
                    {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                </button>
            </div>

            {/* Code Content */}
            <div className="text-[10px] [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-3">
                <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={language}
                    PreTag="div"
                    showLineNumbers={true}
                    lineNumberStyle={{
                        minWidth: '2em',
                        paddingRight: '1em',
                        color: '#6e7681',
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
