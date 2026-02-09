"use client";

import React, { useState, useEffect } from 'react';
import { Search, File, FileText, Loader2 } from 'lucide-react';

interface SearchResult {
    file: string;
    line?: number;
    text?: string;
    matchType: 'file' | 'content';
}

interface SearchPanelProps {
    onSelect: (path: string, line?: number) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onSelect }) => {
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState<'file' | 'content'>('content');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [debouncedQuery, setDebouncedQuery] = useState('');

    // Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 500);
        return () => clearTimeout(timer);
    }, [query]);

    // Search Effect
    useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setResults([]);
            return;
        }

        const doSearch = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/fs/search?q=${encodeURIComponent(debouncedQuery)}&type=${searchType}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data.results || []);
                }
            } catch (e) {
                console.error("Search error", e);
            } finally {
                setLoading(false);
            }
        };

        void doSearch();
    }, [debouncedQuery, searchType]);

    return (
        <div className="flex flex-col h-full bg-bg-surface text-text-primary">
            <div className="p-3 border-b border-border-subtle space-y-3">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
                    <input
                        className="w-full bg-bg-elevated border border-border-strong rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-border-strong placeholder-text-muted transition-colors"
                        placeholder={searchType === 'content' ? "Find in files..." : "Go to file..."}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSearchType('content')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded text-xs font-medium transition-colors ${searchType === 'content'
                            ? 'bg-state-active text-text-primary'
                            : 'bg-bg-elevated text-text-muted hover:text-text-primary hover:bg-state-hover'
                            }`}
                    >
                        <FileText size={14} />
                        Content
                    </button>
                    <button
                        onClick={() => setSearchType('file')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded text-xs font-medium transition-colors ${searchType === 'file'
                            ? 'bg-state-active text-text-primary'
                            : 'bg-bg-elevated text-text-muted hover:text-text-primary hover:bg-state-hover'
                            }`}
                    >
                        <File size={14} />
                        Files
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-text-muted gap-2">
                        <Loader2 className="animate-spin h-4 w-4" />
                        <span>Searching...</span>
                    </div>
                ) : results.length === 0 && debouncedQuery.length >= 2 ? (
                    <div className="p-4 text-center text-text-muted text-xs">
                        No results found
                    </div>
                ) : (
                    <div className="divide-y divide-border-subtle/30">
                        {results.map((r, i) => (
                            <div
                                key={i}
                                className="group flex flex-col px-4 py-2 hover:bg-state-hover cursor-pointer transition-colors"
                                onClick={() => onSelect(r.file, r.line)}
                            >
                                <div className="flex items-center gap-2 text-text-primary overflow-hidden">
                                    <File size={12} className="text-text-muted shrink-0" />
                                    <span className="truncate font-medium text-xs text-status-info-text" title={r.file}>
                                        {r.file}
                                    </span>
                                </div>
                                {r.matchType === 'content' && (
                                    <div className="mt-1 pl-5 text-xs text-text-secondary truncate font-mono opacity-80 group-hover:opacity-100">
                                        <span className="text-text-muted mr-2 inline-block w-6 text-right select-none border-r border-border-subtle pr-1">{r.line}</span>
                                        {r.text}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="border-t border-border-subtle p-2 text-[10px] text-text-muted text-center uppercase tracking-widest font-bold">
                {results.length} results
            </div>
        </div>
    );
};
