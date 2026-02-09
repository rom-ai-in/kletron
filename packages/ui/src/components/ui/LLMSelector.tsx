'use client';

import React, { useState } from 'react';
import { ChevronDown, Check, Zap, AlertCircle } from 'lucide-react';

export interface LLMProvider {
    id: string;
    label: string;
    models: Array<{ id: string; label: string }>;
    connected: boolean;
}

export interface LLMSelectorProps {
    providers: LLMProvider[];
    selectedProvider?: string | null;
    selectedModel?: string | null;
    onProviderChange?: (provider: string) => void;
    onModelChange?: (model: string) => void;
    onTest?: () => Promise<boolean>;
    loading?: boolean;
    compact?: boolean;
    className?: string;
}

const PROVIDER_ICONS: Record<string, string> = {
    openai: 'AI',
    claude: 'CL',
    azure: 'AZ',
    gemini: 'GE',
    ollama: 'OL',
    lmstudio: 'LM',
};

function ProviderIcon({ providerId }: { providerId: string }) {
    const label = PROVIDER_ICONS[providerId] || providerId.slice(0, 2).toUpperCase();
    return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-bg-elevated text-[9px] font-bold text-text-secondary">
            {label}
        </span>
    );
}

export function LLMSelector({
    providers,
    selectedProvider,
    selectedModel,
    onProviderChange,
    onModelChange,
    onTest,
    loading,
    compact = false,
    className = '',
}: LLMSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [testing, setTesting] = useState(false);

    const currentProvider = providers.find(p => p.id === selectedProvider);
    const currentModel = currentProvider?.models.find(m => m.id === selectedModel);

    if (compact) {
        return (
            <div className={`relative ${className}`}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-xs text-text-primary hover:bg-bg-elevated transition-colors"
                >
                    {currentProvider && <ProviderIcon providerId={currentProvider.id} />}
                    <span className="truncate max-w-[120px]">
                        {currentModel?.label || currentProvider?.label || 'Select model'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-text-muted" />
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <div className="absolute right-0 bottom-full mb-1 z-50 w-56 max-h-80 overflow-y-auto rounded-md border border-border-strong bg-bg-surface shadow-xl">
                            {providers.map(provider => (
                                <div key={provider.id}>
                                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border-subtle">
                                        <div className="flex items-center gap-2">
                                            <ProviderIcon providerId={provider.id} />
                                            {provider.label}
                                            {provider.connected && <Check className="w-3 h-3 text-status-success-text" />}
                                        </div>
                                    </div>
                                    {provider.models.map(model => (
                                        <button
                                            key={model.id}
                                            type="button"
                                            onClick={() => {
                                                onProviderChange?.(provider.id);
                                                onModelChange?.(model.id);
                                                setIsOpen(false);
                                            }}
                                            className={`flex items-center justify-between w-full px-3 py-1.5 text-xs transition-colors ${
                                                selectedProvider === provider.id && selectedModel === model.id
                                                    ? 'bg-bg-elevated text-text-primary'
                                                    : 'text-text-secondary hover:bg-bg-elevated/50 hover:text-text-primary'
                                            }`}
                                        >
                                            <span className="pl-7">{model.label}</span>
                                            {selectedProvider === provider.id && selectedModel === model.id && (
                                                <Check className="w-3 h-3 text-status-success-text" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ))}
                            {providers.length === 0 && (
                                <div className="px-3 py-3 text-xs text-text-muted text-center">
                                    No providers configured
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Full mode for settings panel
    return (
        <div className={`space-y-3 ${className}`}>
            {providers.map(provider => (
                <div
                    key={provider.id}
                    className={`rounded-md border px-3 py-2 transition-colors cursor-pointer ${
                        selectedProvider === provider.id
                            ? 'border-border-strong bg-bg-elevated/50'
                            : 'border-border-subtle hover:border-border-strong'
                    }`}
                    onClick={() => onProviderChange?.(provider.id)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ProviderIcon providerId={provider.id} />
                            <span className="text-sm font-medium text-text-primary">{provider.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {provider.connected ? (
                                <span className="flex items-center gap-1 text-[10px] text-status-success-text">
                                    <Zap className="w-3 h-3" /> Active
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] text-text-muted">
                                    <AlertCircle className="w-3 h-3" /> Inactive
                                </span>
                            )}
                            {selectedProvider === provider.id && <Check className="w-4 h-4 text-status-success-text" />}
                        </div>
                    </div>
                    {provider.models.length > 0 && selectedProvider === provider.id && (
                        <div className="mt-2 space-y-1">
                            {provider.models.map(model => (
                                <button
                                    key={model.id}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onModelChange?.(model.id);
                                    }}
                                    className={`flex items-center justify-between w-full rounded px-2 py-1 text-xs transition-colors ${
                                        selectedModel === model.id
                                            ? 'bg-state-active text-text-primary'
                                            : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                                    }`}
                                >
                                    <span>{model.label}</span>
                                    {selectedModel === model.id && <Check className="w-3 h-3 text-status-success-text" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {providers.length === 0 && (
                <div className="rounded-md border border-border-subtle px-3 py-4 text-xs text-text-muted text-center">
                    No LLM providers configured. Configure them in the web portal.
                </div>
            )}

            {/* Test Connection Button */}
            {onTest && selectedProvider && (
                <button
                    type="button"
                    onClick={async () => {
                        setTesting(true);
                        try {
                            const ok = await onTest();
                            // Result is visual — handled by caller
                        } finally {
                            setTesting(false);
                        }
                    }}
                    disabled={testing || loading}
                    className="w-full rounded-md border border-border-strong bg-bg-elevated px-3 py-2 text-xs font-medium text-text-primary hover:bg-state-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {testing ? (
                        <>
                            <Zap className="w-3.5 h-3.5 animate-pulse" />
                            Testing connection...
                        </>
                    ) : (
                        <>
                            <Zap className="w-3.5 h-3.5" />
                            Test Connection
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
