"use client";

import React, { useState, useEffect, useRef } from "react";
import { Folder, ChevronRight, ChevronDown, Search, FolderOpen, Loader2, X } from "lucide-react";

export interface FolderTreePickerProps {
    value: string;
    onChange: (path: string) => void;
    placeholder?: string;
}

interface TreeItem {
    name: string;
    path: string;
    type: "directory" | "file";
    children?: TreeItem[];
    isOpen?: boolean;
    isLoading?: boolean;
}

export function FolderTreePicker({ value, onChange, placeholder }: FolderTreePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [tree, setTree] = useState<TreeItem[]>([]);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial fetch for root
    useEffect(() => {
        if (isOpen && tree.length === 0) {
            void fetchNode("");
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchNode = async (nodePath: string) => {
        try {
            // Use the correct API endpoint and pass root parameter
            const queryParams = new URLSearchParams();
            if (nodePath) {
                queryParams.set('root', nodePath);
            }
            const res = await fetch(`/api/fs/tree${queryParams.toString() ? '?' + queryParams.toString() : ''}`);
            const data = await res.json();

            // The API returns an array of TreeNode objects directly
            // Transform to match our TreeItem interface (filtering to directories only)
            const folders: TreeItem[] = Array.isArray(data)
                ? data
                    .filter((node: { isDirectory: boolean }) => node.isDirectory)
                    .map((node: { path: string; name: string; isDirectory: boolean }) => ({
                        name: node.name,
                        path: node.path,
                        type: 'directory' as const,
                    }))
                : [];

            if (nodePath === "") {
                setTree(folders);
            } else {
                setTree(prev => updateTree(prev, nodePath, folders));
            }
        } catch (e) {
            console.error("Failed to fetch tree node", e);
            // Set empty array to avoid undefined state on error
            if (nodePath === "") {
                setTree([]);
            }
        }
    };

    const updateTree = (items: TreeItem[], path: string, children: TreeItem[]): TreeItem[] => {
        return items.map(item => {
            if (item.path === path) {
                return { ...item, children, isLoading: false, isOpen: true };
            }
            if (item.children) {
                return { ...item, children: updateTree(item.children, path, children) };
            }
            return item;
        });
    };

    const toggleNode = async (item: TreeItem, e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.isOpen) {
            setTree(prev => setNodeOpen(prev, item.path, false));
        } else {
            if (!item.children) {
                setTree(prev => setNodeLoading(prev, item.path, true));
                await fetchNode(item.path);
            } else {
                setTree(prev => setNodeOpen(prev, item.path, true));
            }
        }
    };

    const setNodeOpen = (items: TreeItem[], path: string, isOpen: boolean): TreeItem[] => {
        return items.map(item => {
            if (item.path === path) return { ...item, isOpen };
            if (item.children) return { ...item, children: setNodeOpen(item.children, path, isOpen) };
            return item;
        });
    };

    const setNodeLoading = (items: TreeItem[], path: string, isLoading: boolean): TreeItem[] => {
        return items.map(item => {
            if (item.path === path) return { ...item, isLoading };
            if (item.children) return { ...item, children: setNodeLoading(item.children, path, isLoading) };
            return item;
        });
    };

    const handleSelect = (path: string) => {
        onChange(path + (path.endsWith("/") || path === "" ? "" : "/"));
        setIsOpen(false);
    };

    const renderItem = (item: TreeItem, depth: number = 0) => {
        return (
            <div key={item.path}>
                <div
                    className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-state-hover rounded-md group transition-colors ${value === item.path + "/" ? "bg-status-success-bg text-status-success-text" : "text-text-secondary"}`}
                    style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
                    onClick={() => handleSelect(item.path)}
                >
                    <div
                        className="p-0.5 hover:bg-state-active rounded transition-colors"
                        onClick={(e) => toggleNode(item, e)}
                    >
                        {item.isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : item.isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                        )}
                    </div>
                    {item.isOpen ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
                    <span className="text-sm truncate">{item.name}</span>
                </div>
                {item.isOpen && item.children && (
                    <div>
                        {item.children.map(child => renderItem(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <div
                className="relative flex items-center cursor-pointer group"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted group-hover:text-text-secondary transition-colors" />
                <div className="w-full flex items-center justify-between rounded-md border border-border-subtle bg-bg-elevated pl-10 pr-3 py-2 text-sm text-text-primary transition-all hover:border-border-strong group-focus-within:border-border-strong font-mono">
                    <span className={value === "" || value === "/" ? "text-status-success-text font-bold" : value ? "text-text-primary" : "text-text-muted"}>
                        {value === "" || value === "/" ? "/ (Root)" : value || placeholder || "Select folder..."}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 z-50 w-full min-w-[300px] max-h-[400px] overflow-hidden rounded-lg border border-border-strong bg-bg-elevated shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-200">
                    <div className="p-2 border-b border-border-subtle bg-state-hover flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-text-muted" />
                        <input
                            autoFocus
                            className="bg-transparent border-none outline-none text-xs text-text-primary w-full placeholder:text-text-muted"
                            placeholder="Search folders..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="p-1 hover:bg-state-active rounded">
                                <X className="h-3 w-3 text-text-muted" />
                            </button>
                        )}
                    </div>
                    <div className="p-2 overflow-y-auto max-h-[350px] scrollbar-elegant">
                        <div
                            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-state-hover rounded-md text-text-secondary transition-colors mb-1 ${value === "" || value === "/" ? "bg-status-success-bg text-status-success-text" : ""}`}
                            onClick={() => handleSelect("")}
                        >
                            <Folder className="h-4 w-4" />
                            <span className="text-sm">/ (Project Root)</span>
                        </div>
                        {!tree || tree.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-text-muted opacity-50">
                                <Loader2 className="h-5 w-5 animate-spin mb-2" />
                                <span className="text-xs">Loading structure...</span>
                            </div>
                        ) : (
                            tree
                                .filter(item => !search || item.name.toLowerCase().includes(search.toLowerCase()))
                                .map(item => renderItem(item))
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}
