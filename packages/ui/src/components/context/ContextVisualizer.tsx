"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FileText, Bot, GitCommit, Globe, RefreshCw as RefreshIcon, Hash, Code, Eye, Edit2 } from "lucide-react";
import type { ContextNode } from "@numezis/shared/context/graph/ContextGraphTypes";

// --- Types ---
interface ContextHUDProps {
    className?: string;
}

// --- Icons Helper ---
const getNodeIcon = (type: ContextNode['type']) => {
    switch (type) {
        case 'file': return FileText;
        case 'agent': return Bot;
        case 'diff': return GitCommit;
        case 'conversation': return Globe;
        case 'symbol': return Hash;
        default: return FileText;
    }
};

const getNodeColor = (type: ContextNode['type']) => {
    switch (type) {
        case 'file': return "text-status-info-text bg-status-info-bg border-status-info-border";
        case 'agent': return "text-purple-400 bg-purple-400/10 border-purple-500/20";
        case 'diff': return "text-status-warning-text bg-status-warning-bg border-status-warning-border";
        case 'conversation': return "text-status-info-text bg-status-info-bg border-status-info-border";
        case 'symbol': return "text-status-success-text bg-status-success-bg border-status-success-border";
        default: return "text-text-muted bg-text-muted/10 border-border-subtle";
    }
};

export function ContextVisualizer({ className }: ContextHUDProps) {
    const [nodes, setNodes] = useState<ContextNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'file' | 'symbol' | 'other'>('all');

    const refreshData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/context/graph");
            const data = await res.json();
            if (data.nodes) {
                // Sort by recency/activity (mock sorting for now, using ID or stats if available)
                const sorted = (data.nodes as ContextNode[]).sort((a, b) => {
                    const scoreA = (a.stats?.viewCount || 0) + (a.stats?.editCount || 0) * 2;
                    const scoreB = (b.stats?.viewCount || 0) + (b.stats?.editCount || 0) * 2;
                    return scoreB - scoreA;
                });
                setNodes(sorted);
            }
        } catch (e) {
            console.error("Failed to load context data", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refreshData(); }, [refreshData]);

    const filteredNodes = nodes.filter(n => {
        if (filter === 'all') return true;
        if (filter === 'file') return n.type === 'file';
        if (filter === 'symbol') return n.type === 'symbol';
        return !['file', 'symbol'].includes(n.type);
    });

    return (
        <div className={`h-full w-full bg-bg-surface flex flex-col text-text-primary ${className}`}>
            {/* Header / Controls */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-elevated/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <FilterButton active={filter === 'all'} label="All" onClick={() => setFilter('all')} count={nodes.length} />
                    <FilterButton active={filter === 'file'} label="Files" onClick={() => setFilter('file')} count={nodes.filter(n => n.type === 'file').length} />
                    <FilterButton active={filter === 'symbol'} label="Symbols" onClick={() => setFilter('symbol')} count={nodes.filter(n => n.type === 'symbol').length} />
                </div>
                <button
                    onClick={refreshData}
                    className={`p-1.5 rounded hover:bg-state-hover text-text-muted transition-all ${loading ? 'animate-spin' : ''}`}
                    title="Refresh Context"
                >
                    <RefreshIcon size={14} />
                </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-elegant">
                {filteredNodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-text-muted italic gap-2">
                        <Globe className="opacity-20 w-12 h-12" />
                        <span>No context nodes found.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredNodes.map((node) => (
                            <ContextCard key={node.id} node={node} />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="px-4 py-2 border-t border-border-subtle text-[10px] text-text-muted flex justify-between bg-bg-elevated/30">
                <span>Total Nodes: {nodes.length}</span>
                <span>Memory Usage: ~{(nodes.length * 0.5).toFixed(1)}KB</span>
            </div>
        </div>
    );
}

// --- Subcomponents ---

const FilterButton = ({ active, label, onClick, count }: { active: boolean, label: string, onClick: () => void, count: number }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5 ${active
            ? "bg-primary-main/10 text-primary-main ring-1 ring-primary-main/30"
            : "text-text-muted hover:text-text-primary hover:bg-state-hover"
            }`}
    >
        {label}
        <span className={`text-[9px] px-1 rounded-full ${active ? 'bg-primary-main text-text-primary' : 'bg-bg-elevated text-text-muted'}`}>
            {count}
        </span>
    </button>
);

const ContextCard = ({ node }: { node: ContextNode }) => {
    const Icon = getNodeIcon(node.type);
    const colorClass = getNodeColor(node.type);

    return (
        <div className="group relative flex flex-col p-3 rounded-lg border border-border-subtle bg-bg-elevated hover:border-border-strong hover:shadow-md transition-all duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className={`p-1.5 rounded-md ${colorClass}`}>
                    <Icon size={14} />
                </div>
                <div className="flex items-center gap-1">
                    {/* Badge for Type */}
                    <span className="text-[9px] uppercase font-bold tracking-wider text-text-subtle opacity-50">{node.type}</span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <h4 className="text-[12px] font-semibold text-text-primary truncate mb-0.5" title={node.label}>
                    {node.label.split('/').pop()}
                </h4>
                {node.type === 'file' && (
                    <p className="text-[10px] text-text-muted truncate font-mono opacity-70" title={node.label}>
                        {node.label}
                    </p>
                )}
            </div>

            {/* Stats Footer */}
            <div className="mt-3 flex items-center gap-3 pt-2 border-t border-border-subtle opacity-60 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1 text-[10px] text-text-muted" title="View Count">
                    <Eye size={10} />
                    <span>{node.stats?.viewCount || 0}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-text-muted" title="Edit Count">
                    <Edit2 size={10} />
                    <span>{node.stats?.editCount || 0}</span>
                </div>
            </div>

            {/* Hover Glow Effect */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
        </div>
    );
};
