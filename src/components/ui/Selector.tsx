import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type SelectorOption = {
    id: string;
    label: string;
    sub?: string;
};

export type SelectorProps = {
    label: string;
    value: string;
    options: SelectorOption[];
    onSelect: (id: string) => void;
    direction?: 'up' | 'down';
    size?: 'sm' | 'md';
    status?: 'success' | 'error' | 'loading' | 'none';
};

export const Selector: React.FC<SelectorProps> = ({ label, value, options, onSelect, direction = 'up', size = 'md', status = 'none' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.id === value) || options[0];

    const isSmall = size === 'sm';

    let statusColor = "bg-transparent";
    if (status === 'success') statusColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
    else if (status === 'error') statusColor = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]";
    else if (status === 'loading') statusColor = "bg-amber-500 animate-pulse";

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded transition-colors group ${isSmall ? 'px-2 py-1' : 'px-3 py-1.5'}`}
                type="button"
            >
                <span className={`font-bold text-zinc-600 uppercase tracking-wider ${isSmall ? 'text-[9px]' : 'text-[10px]'}`}>{label}</span>
                <span className={`text-zinc-300 font-medium truncate max-w-[120px] ${isSmall ? 'text-[11px]' : 'text-[13px]'}`}>{selectedOption?.label || value}</span>

                {status && status !== 'none' && (
                    <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                )}

                <ChevronDown className={`text-zinc-600 group-hover:text-zinc-400 transition-all duration-200 ${isOpen ? 'rotate-180' : ''} ${isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
            </button>

            {isOpen && (
                <div
                    className={`absolute left-0 mb-1 min-w-[180px] bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col p-1 ${direction === 'up' ? 'bottom-full origin-bottom' : 'top-full mt-1 origin-top'
                        }`}
                >
                    {options.map((option) => (
                        <button
                            key={option.id}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent bubbling
                                onSelect(option.id);
                                setIsOpen(false);
                            }}
                            className={`flex items-center justify-between w-full px-2 py-1.5 text-left rounded-md transition-colors ${option.id === value ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                                }`}
                            type="button"
                        >
                            <div className="flex flex-col gap-0.5">
                                <div className="text-[11px] font-medium leading-tight">{option.label}</div>
                                {option.sub && <div className="text-[9px] text-zinc-600 leading-tight">{option.sub}</div>}
                            </div>
                            {option.id === value && <Check className="w-3 h-3 text-emerald-500" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
