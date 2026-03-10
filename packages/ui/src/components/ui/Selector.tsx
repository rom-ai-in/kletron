import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type SelectorOption = {
    id: string;
    label: string;
    sub?: string;
    hasWarning?: boolean;
};

export type SelectorProps = {
    label: string;
    value: string;
    options: SelectorOption[];
    onSelect: (id: string) => void;
    direction?: 'up' | 'down';
    size?: 'sm' | 'md';
    status?: 'success' | 'error' | 'loading' | 'none';
    loading?: boolean;
    fullWidth?: boolean;
};

export const Selector: React.FC<SelectorProps> = ({ label, value, options, onSelect, direction = 'up', size = 'md', status = 'none', loading = false, fullWidth = false }) => {
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
    if (status === 'success') statusColor = "bg-status-success shadow-[0_0_8px_var(--status-success-border)]";
    else if (status === 'error') statusColor = "bg-status-error shadow-[0_0_8px_var(--status-error-border)]";
    else if (status === 'loading') statusColor = "bg-status-warning animate-pulse";

    return (
        <div className={`relative ${fullWidth ? 'w-full' : ''}`} ref={containerRef}>
            {loading ? (
                <div className={`flex items-center gap-1.5 bg-bg-surface/50 border border-border-subtle rounded ${isSmall ? 'px-2 py-1' : 'px-3 py-1.5'} ${fullWidth ? 'w-full justify-between' : ''}`}>
                    <span className={`font-bold text-text-muted uppercase tracking-wider ${isSmall ? 'text-[9px]' : 'text-[10px]'}`}>{label}</span>
                    <div className={`bg-bg-elevated/50 rounded animate-pulse w-full h-4`} />
                    <ChevronDown className={`text-text-muted ${isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-1.5 bg-bg-surface/50 hover:bg-state-hover border border-border-subtle hover:border-border-strong rounded transition-colors group ${isSmall ? 'px-2 py-1' : 'px-3 py-1.5'} ${fullWidth ? 'w-full justify-between' : ''}`}
                    type="button"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-label={`${label}: ${selectedOption?.label || value}`}
                >
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`font-bold text-text-muted uppercase tracking-wider shrink-0 ${isSmall ? 'text-[9px]' : 'text-[10px]'}`}>{label}</span>
                        <span className={`text-text-primary font-medium truncate ${isSmall ? 'text-[11px]' : 'text-[13px]'} ${fullWidth ? 'max-w-full' : 'max-w-[120px]'}`}>{selectedOption?.label || value}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {status && status !== 'none' && (
                            <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} aria-hidden="true" />
                        )}
                        <ChevronDown className={`text-text-muted group-hover:text-text-secondary transition-all duration-200 ${isOpen ? 'rotate-180' : ''} ${isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} aria-hidden="true" />
                    </div>
                </button>
            )}

            {isOpen && !loading && (
                <div
                    role="listbox"
                    aria-label={label}
                    className={`absolute left-0 mb-1 bg-bg-surface border border-border-subtle rounded-lg shadow-xl overflow-y-auto max-h-60 z-[100] flex flex-col p-1 ${direction === 'up' ? 'bottom-full origin-bottom' : 'top-full mt-1 origin-top'
                        } ${fullWidth ? 'w-full' : 'min-w-[180px]'}`}
                >
                    {options.map((option) => (
                        <button
                            key={option.id}
                            role="option"
                            aria-selected={option.id === value}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(option.id);
                                setIsOpen(false);
                            }}
                            className={`flex items-center justify-between w-full px-2 py-1.5 text-left rounded-md transition-colors ${option.id === value ? 'bg-state-active text-text-primary' : 'text-text-secondary hover:bg-state-hover hover:text-text-primary'
                                }`}
                            type="button"
                        >
                            <div className="flex flex-col gap-0.5">
                                <div className="text-[11px] font-medium leading-tight flex items-center gap-1.5">
                                    {option.label}
                                    {option.hasWarning && (
                                        <span className="rounded-[4px] border border-status-warning-border bg-status-warning-bg px-1.5 py-0.5 text-[8.5px] font-bold text-status-warning-text whitespace-nowrap">
                                            Attention Needed
                                        </span>
                                    )}
                                </div>
                                {option.sub && <div className="text-[9px] text-text-muted leading-tight">{option.sub}</div>}
                            </div>
                            {option.id === value && <Check className="w-3 h-3 text-status-success-text" aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
