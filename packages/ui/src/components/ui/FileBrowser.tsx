'use client';

import React, { useState, useCallback } from 'react';
import {
    RefreshCw, FolderPlus, FilePlus, ChevronsDownUp, Search,
    ChevronRight, ChevronDown, File, Folder, FolderOpen,
    FileCode, FileJson, FileText, FileImage, Cog
} from 'lucide-react';

export interface FileEntry {
    path: string;
    name: string;
    isDirectory: boolean;
}

export interface FileBrowserProps {
    files: FileEntry[];
    selectedPath?: string | null;
    expandedPaths?: Set<string>;
    onFileSelect?: (path: string) => void;
    onFileOpen?: (path: string) => void;
    onDirectoryToggle?: (path: string) => void;
    onDirectoryExpand?: (path: string) => void;
    onCollapseAll?: () => void;
    onNewFile?: (parentPath?: string) => void;
    onNewFolder?: (parentPath?: string) => void;
    onContextMenu?: (event: React.MouseEvent, path: string, isDir: boolean) => void;
    onRefresh?: () => void;
    loading?: boolean;
    className?: string;
}

function getFileIcon(filename: string): React.ReactNode {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts': case 'tsx': case 'js': case 'jsx':
            return <FileCode className="w-4 h-4 text-status-info-text" />;
        case 'json':
            return <FileJson className="w-4 h-4 text-status-warning-text" />;
        case 'md': case 'txt':
            return <FileText className="w-4 h-4 text-text-secondary" />;
        case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg':
            return <FileImage className="w-4 h-4 text-status-success-text" />;
        case 'css': case 'scss':
            return <FileCode className="w-4 h-4 text-violet-400" />;
        case 'yaml': case 'yml': case 'config':
            return <Cog className="w-4 h-4 text-text-muted" />;
        default:
            return <File className="w-4 h-4 text-text-secondary" />;
    }
}

interface TreeItem {
    path: string;
    name: string;
    isDirectory: boolean;
    depth: number;
    children?: TreeItem[];
}

function buildTree(files: FileEntry[], expandedPaths: Set<string>): TreeItem[] {
    const rootItems: TreeItem[] = [];
    const dirMap = new Map<string, TreeItem[]>();

    // Sort: directories first, then alphabetically
    const sorted = [...files].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    for (const file of sorted) {
        const parts = file.path.split('/');
        const depth = parts.length - 1;
        const parentPath = parts.slice(0, -1).join('/');

        const item: TreeItem = { path: file.path, name: file.name, isDirectory: file.isDirectory, depth };

        if (depth === 0 || !parentPath) {
            rootItems.push(item);
        } else {
            if (!dirMap.has(parentPath)) dirMap.set(parentPath, []);
            dirMap.get(parentPath)!.push(item);
        }
    }

    // Recursively attach children
    function attachChildren(items: TreeItem[]): TreeItem[] {
        return items.map(item => ({
            ...item,
            children: item.isDirectory && expandedPaths.has(item.path)
                ? attachChildren(dirMap.get(item.path) || [])
                : undefined,
        }));
    }

    return attachChildren(rootItems);
}

function TreeNode({
    item, selectedPath, expandedPaths, onFileSelect, onFileOpen, onDirectoryToggle, onContextMenu,
}: {
    item: TreeItem;
    selectedPath?: string | null;
    expandedPaths: Set<string>;
    onFileSelect?: (path: string) => void;
    onFileOpen?: (path: string) => void;
    onDirectoryToggle?: (path: string) => void;
    onContextMenu?: (event: React.MouseEvent, path: string, isDir: boolean) => void;
}) {
    const isExpanded = expandedPaths.has(item.path);
    const isSelected = selectedPath === item.path;
    const paddingLeft = item.depth * 12 + 8;

    return (
        <>
            <div
                className={`flex items-center gap-1 py-1 cursor-pointer transition-colors group ${
                    isSelected ? 'bg-bg-elevated text-text-primary' : 'text-text-primary hover:bg-state-hover'
                }`}
                style={{ paddingLeft }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (item.isDirectory) onDirectoryToggle?.(item.path);
                    onFileSelect?.(item.path);
                }}
                onDoubleClick={() => {
                    if (!item.isDirectory) onFileOpen?.(item.path);
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu?.(e, item.path, item.isDirectory);
                }}
            >
                <span className="w-4 h-4 flex items-center justify-center">
                    {item.isDirectory && (
                        isExpanded
                            ? <ChevronDown className="w-3 h-3 text-text-muted" />
                            : <ChevronRight className="w-3 h-3 text-text-muted" />
                    )}
                </span>
                <span className="w-4 h-4 flex items-center justify-center">
                    {item.isDirectory
                        ? (isExpanded
                            ? <FolderOpen className="w-4 h-4 text-status-warning-text" />
                            : <Folder className="w-4 h-4 text-status-warning-text" />)
                        : getFileIcon(item.name)
                    }
                </span>
                <span className="text-xs truncate flex-1">{item.name}</span>
            </div>
            {item.isDirectory && isExpanded && item.children?.map(child => (
                <TreeNode
                    key={child.path}
                    item={child}
                    selectedPath={selectedPath}
                    expandedPaths={expandedPaths}
                    onFileSelect={onFileSelect}
                    onFileOpen={onFileOpen}
                    onDirectoryToggle={onDirectoryToggle}
                    onContextMenu={onContextMenu}
                />
            ))}
        </>
    );
}

export function FileBrowser({
    files,
    selectedPath,
    expandedPaths = new Set(),
    onFileSelect,
    onFileOpen,
    onDirectoryToggle,
    onDirectoryExpand,
    onCollapseAll,
    onNewFile,
    onNewFolder,
    onContextMenu,
    onRefresh,
    loading,
    className = '',
}: FileBrowserProps) {
    const [filter, setFilter] = useState('');

    const tree = buildTree(files, expandedPaths);
    const filteredTree = filter
        ? tree.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()))
        : tree;

    // Use onDirectoryExpand if provided, falling back to onDirectoryToggle
    const handleDirectoryAction = onDirectoryExpand || onDirectoryToggle;

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border-subtle">
                <div className="flex-1 relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
                    <input
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter files..."
                        className="w-full rounded-md bg-bg-surface border border-border-subtle py-1 pl-7 pr-2 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => onNewFile?.(selectedPath ?? undefined)}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                    title="New File"
                >
                    <FilePlus className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => onNewFolder?.(selectedPath ?? undefined)}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                    title="New Folder"
                >
                    <FolderPlus className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onClick={onCollapseAll}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                    title="Collapse All"
                >
                    <ChevronsDownUp className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* File Tree */}
            <div className="flex-1 overflow-y-auto py-1">
                {filteredTree.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-text-muted text-center">
                        {loading ? 'Loading...' : files.length === 0 ? 'No workspace selected' : 'No matching files'}
                    </div>
                ) : (
                    filteredTree.map(item => (
                        <TreeNode
                            key={item.path}
                            item={item}
                            selectedPath={selectedPath}
                            expandedPaths={expandedPaths}
                            onFileSelect={onFileSelect}
                            onFileOpen={onFileOpen}
                            onDirectoryToggle={onDirectoryToggle}
                            onContextMenu={onContextMenu}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
