"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, File, FolderOpen, Search, X, Loader2, FileText, Sparkles, RefreshCw, FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { TreeNode } from '../pages/api/fs/tree';
import { useEditorState } from '../context/EditorContext';
import { ContextMenu, ContextMenuEntry } from './ui/ContextMenu';

interface FileTreeProps {
    onSelect: (filePath: string) => void;
    currentFile?: string; // Track the selected file for highlighting
}

interface SearchResult {
    file: string;
    line?: number;
    text?: string;
    matchType: 'file' | 'content' | 'semantic';
    score?: number;
}

interface ContextMenuState {
    x: number;
    y: number;
    node: TreeNode;
}

const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
    if (!query || query.length < 2) return <>{text}</>;

    // Escape special regex chars
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <span key={i} className="bg-yellow-500/30 text-yellow-200 font-bold rounded-[2px] px-0.5">{part}</span>
                ) : (
                    part
                )
            )}
        </>
    );
};

interface FileTreeNodeProps {
    node: TreeNode;
    onSelect: (path: string) => void;
    level: number;
    currentFile?: string;
    onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
    editingPath: string | null;
    onRenameSubmit: (oldPath: string, newName: string) => void;
    onRenameCancel: () => void;
    newItemParent: string | null;
    newItemType: 'file' | 'folder' | null;
    onNewItemSubmit: (parentPath: string, name: string, type: 'file' | 'folder') => void;
    onNewItemCancel: () => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
    node,
    onSelect,
    level,
    currentFile,
    onContextMenu,
    editingPath,
    onRenameSubmit,
    onRenameCancel,
    newItemParent,
    newItemType,
    onNewItemSubmit,
    onNewItemCancel
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [renameValue, setRenameValue] = useState(node.name);
    const [newItemName, setNewItemName] = useState('');
    const { state } = useEditorState();
    const isDir = node.isDirectory;
    const paddingLeft = level * 12 + 4; // 12px indentation per level
    const isEditing = editingPath === node.path;
    const showNewItem = newItemParent === node.path && newItemType !== null;

    // Auto-expand when creating new item in this folder
    useEffect(() => {
        if (showNewItem && !isOpen) {
            setIsOpen(true);
        }
    }, [showNewItem, isOpen]);

    // Determine file status
    const hasAgents = state.fileAgents[node.path]?.length > 0;
    const hasDiffs = (state.pendingDiffs[node.path]?.length || 0) > 0;
    const hasConflict = state.pendingDiffs[node.path]?.some(d => d.status === 'conflict') || false;
    const isSelected = currentFile === node.path;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isEditing) return;
        if (isDir) {
            setIsOpen(!isOpen);
        } else {
            onSelect(node.path);
        }
    };

    const handleRightClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, node);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (renameValue.trim() && renameValue !== node.name) {
                onRenameSubmit(node.path, renameValue.trim());
            } else {
                onRenameCancel();
            }
        } else if (e.key === 'Escape') {
            onRenameCancel();
        }
    };

    const handleNewItemKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (newItemName.trim()) {
                onNewItemSubmit(node.path, newItemName.trim(), newItemType!);
            } else {
                onNewItemCancel();
            }
        } else if (e.key === 'Escape') {
            onNewItemCancel();
        }
    };

    return (
        <div>
            <div
                className={`flex items-center py-1 px-2 cursor-pointer hover:bg-state-hover text-sm whitespace-nowrap text-text-secondary hover:text-text-primary select-none transition-colors ${isSelected ? 'bg-state-hover/50' : ''}`}
                style={{ paddingLeft: `${paddingLeft}px` }}
                onClick={handleClick}
                onContextMenu={handleRightClick}
            >
                <span className="mr-1 text-zinc-400">
                    {isDir ? (
                        isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />
                    ) : (
                        <span className="w-[15px] inline-block" />
                    )}
                </span>
                <span className="mr-2 flex-shrink-0">
                    {isDir ? (
                        isOpen ? <FolderOpen size={15} className="text-sky-500" /> : <Folder size={15} className="text-text-muted" />
                    ) : (
                        <File size={15} className="text-text-muted" />
                    )}
                </span>

                {isEditing ? (
                    <input
                        autoFocus
                        className="flex-1 bg-zinc-700 border border-sky-500 rounded px-1 py-0.5 text-[13px] text-white outline-none"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={() => {
                            if (renameValue.trim() && renameValue !== node.name) {
                                onRenameSubmit(node.path, renameValue.trim());
                            } else {
                                onRenameCancel();
                            }
                        }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className="truncate flex-1 text-[13px]">{node.name}</span>
                )}

                {/* Status Badge */}
                {!isDir && !isEditing && (
                    <>
                        {hasConflict && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-auto flex-shrink-0 animate-pulse" title="Has conflicts" />
                        )}
                        {!hasConflict && hasDiffs && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-auto flex-shrink-0" title="Has pending diffs" />
                        )}
                        {!hasConflict && !hasDiffs && hasAgents && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-auto flex-shrink-0" title="Active agents" />
                        )}
                        {!hasConflict && !hasDiffs && !hasAgents && isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-auto flex-shrink-0" title="Current file" />
                        )}
                    </>
                )}
            </div>

            {isDir && isOpen && (
                <div>
                    {/* New item input row */}
                    {showNewItem && (
                        <div
                            className="flex items-center py-1 px-2 text-sm"
                            style={{ paddingLeft: `${(level + 1) * 12 + 4}px` }}
                        >
                            <span className="mr-1 text-zinc-400">
                                <span className="w-[15px] inline-block" />
                            </span>
                            <span className="mr-2 flex-shrink-0">
                                {newItemType === 'folder' ? (
                                    <Folder size={15} className="text-sky-500" />
                                ) : (
                                    <File size={15} className="text-text-muted" />
                                )}
                            </span>
                            <input
                                autoFocus
                                className="flex-1 bg-zinc-700 border border-sky-500 rounded px-1 py-0.5 text-[13px] text-white outline-none"
                                placeholder={newItemType === 'folder' ? 'folder name' : 'file name'}
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                                onKeyDown={handleNewItemKeyDown}
                                onBlur={() => {
                                    if (newItemName.trim()) {
                                        onNewItemSubmit(node.path, newItemName.trim(), newItemType!);
                                    } else {
                                        onNewItemCancel();
                                    }
                                }}
                            />
                        </div>
                    )}

                    {node.children?.map((child) => (
                        <FileTreeNode
                            key={child.path}
                            node={child}
                            onSelect={onSelect}
                            level={level + 1}
                            currentFile={currentFile}
                            onContextMenu={onContextMenu}
                            editingPath={editingPath}
                            onRenameSubmit={onRenameSubmit}
                            onRenameCancel={onRenameCancel}
                            newItemParent={newItemParent}
                            newItemType={newItemType}
                            onNewItemSubmit={onNewItemSubmit}
                            onNewItemCancel={onNewItemCancel}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const FileTree: React.FC<FileTreeProps> = ({ onSelect, currentFile }) => {
    // Tree State
    const [treeData, setTreeData] = useState<TreeNode[]>([]);
    const [loadingTree, setLoadingTree] = useState(true);
    const [treeError, setTreeError] = useState<string | null>(null);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [searchType, setSearchType] = useState<'file' | 'content' | 'semantic'>('file');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // User-added feature: Repo Name
    const [repoName, setRepoName] = useState<string>("");
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    // Editing State
    const [editingPath, setEditingPath] = useState<string | null>(null);
    const [newItemParent, setNewItemParent] = useState<string | null>(null);
    const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);

    // Confirmation Dialog State
    const [deleteConfirm, setDeleteConfirm] = useState<TreeNode | null>(null);

    // Fetch tree data function (reusable for refresh)
    const refreshTree = useCallback(async () => {
        setIsRefreshing(true);
        const t = Date.now();
        try {
            const res = await fetch(`/api/fs/tree?t=${t}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            if (!res.ok) throw new Error('Failed to load file tree');
            const data = await res.json();
            setTreeData(data);
            setTreeError(null);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error(err);
            setTreeError(errorMessage);
        } finally {
            setLoadingTree(false);
            setIsRefreshing(false);
        }
    }, []);

    // Load Tree & Env Info on mount
    useEffect(() => {
        const t = Date.now();

        // Fetch repo info
        fetch(`/api/env?t=${t}`)
            .then(r => r.json())
            .then(d => {
                if (d.targetDir) {
                    const name = d.targetDir.split('/').pop() || d.targetDir;
                    setRepoName(name);
                }
            })
            .catch(() => { /* Ignore env error */ });

        // Fetch tree on mount
        refreshTree();
    }, [refreshTree]);

    // Debounce Query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Perform Search
    useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const doSearch = async () => {
            setIsSearching(true);
            try {
                let results: SearchResult[] = [];

                if (searchType === 'semantic') {
                    const res = await fetch('/api/vectors/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: debouncedQuery, maxResults: 20 })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        results = (data.results || []).map((r: { filePath: string; startLine?: number; content?: string; score?: number }) => ({
                            file: r.filePath,
                            line: r.startLine,
                            text: r.content,
                            matchType: 'semantic',
                            score: r.score
                        }));
                    }
                } else {
                    const res = await fetch(`/api/fs/search?q=${encodeURIComponent(debouncedQuery)}&type=${searchType}`);
                    if (res.ok) {
                        const data = await res.json();
                        results = data.results || [];
                    }
                }
                setSearchResults(results);
            } catch (e) {
                console.error("Search error", e);
            } finally {
                setIsSearching(false);
            }
        };

        void doSearch();
    }, [debouncedQuery, searchType]);

    const handleClearSearch = () => {
        setSearchQuery('');
        setDebouncedQuery('');
    };

    // Context Menu Handlers
    const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, node });
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    // File Operations
    const handleCreateFolder = useCallback(async (parentPath: string, name: string) => {
        try {
            const fullPath = `${parentPath}/${name}`;
            const res = await fetch('/api/fs/mkdir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: fullPath })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create folder');
            }
            await refreshTree();
        } catch (err) {
            console.error('Error creating folder:', err);
            alert(err instanceof Error ? err.message : 'Failed to create folder');
        }
    }, [refreshTree]);

    const handleCreateFile = useCallback(async (parentPath: string, name: string) => {
        try {
            const fullPath = `${parentPath}/${name}`;
            const res = await fetch('/api/fs/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: fullPath, content: '' })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create file');
            }
            await refreshTree();
            onSelect(fullPath); // Open the new file
        } catch (err) {
            console.error('Error creating file:', err);
            alert(err instanceof Error ? err.message : 'Failed to create file');
        }
    }, [refreshTree, onSelect]);

    const handleRename = useCallback(async (oldPath: string, newName: string) => {
        try {
            const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
            const newPath = `${parentPath}/${newName}`;
            const res = await fetch('/api/fs/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath, newPath })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to rename');
            }
            await refreshTree();
        } catch (err) {
            console.error('Error renaming:', err);
            alert(err instanceof Error ? err.message : 'Failed to rename');
        } finally {
            setEditingPath(null);
        }
    }, [refreshTree]);

    const handleDelete = useCallback(async (node: TreeNode) => {
        try {
            const res = await fetch('/api/fs/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: node.path })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete');
            }
            await refreshTree();
        } catch (err) {
            console.error('Error deleting:', err);
            alert(err instanceof Error ? err.message : 'Failed to delete');
        } finally {
            setDeleteConfirm(null);
        }
    }, [refreshTree]);

    const handleNewItemSubmit = useCallback((parentPath: string, name: string, type: 'file' | 'folder') => {
        if (type === 'folder') {
            handleCreateFolder(parentPath, name);
        } else {
            handleCreateFile(parentPath, name);
        }
        setNewItemParent(null);
        setNewItemType(null);
    }, [handleCreateFolder, handleCreateFile]);

    const handleNewItemCancel = useCallback(() => {
        setNewItemParent(null);
        setNewItemType(null);
    }, []);

    const handleRenameCancel = useCallback(() => {
        setEditingPath(null);
    }, []);

    // Build context menu items
    const getContextMenuItems = useCallback((node: TreeNode): ContextMenuEntry[] => {
        const items: ContextMenuEntry[] = [];

        if (node.isDirectory) {
            items.push({
                label: 'New File',
                icon: <FilePlus size={14} />,
                onClick: () => {
                    setNewItemParent(node.path);
                    setNewItemType('file');
                }
            });
            items.push({
                label: 'New Folder',
                icon: <FolderPlus size={14} />,
                onClick: () => {
                    setNewItemParent(node.path);
                    setNewItemType('folder');
                }
            });
            items.push({ type: 'separator' });
        }

        items.push({
            label: 'Rename',
            icon: <Pencil size={14} />,
            onClick: () => setEditingPath(node.path)
        });

        items.push({
            label: 'Delete',
            icon: <Trash2 size={14} />,
            onClick: () => setDeleteConfirm(node),
            danger: true
        });

        return items;
    }, []);

    return (
        <div className="flex flex-col h-full bg-bg-surface border-r border-border-subtle font-sans">
            {/* Search Header */}
            <div className="p-3 border-b border-border-subtle space-y-2 bg-bg-surface z-10">
                <div className="relative group">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted group-focus-within:text-sky-500 transition-colors" />
                    <input
                        className="w-full bg-bg-elevated border border-border-subtle rounded-md py-2 pl-8 pr-8 text-sm focus:outline-none focus:border-zinc-500 placeholder-text-muted transition-colors"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={handleClearSearch}
                            className="absolute right-2 top-2 hover:bg-zinc-700/50 rounded p-0.5 text-text-muted transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Search Type Toggles (only visible when typing) */}
                {searchQuery && (
                    <div className="flex gap-1">
                        <button
                            onClick={() => setSearchType('file')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[10px] uppercase font-bold tracking-wider transition-colors ${searchType === 'file'
                                ? 'bg-zinc-700 text-white'
                                : 'bg-bg-elevated text-text-muted hover:text-text-primary hover:bg-state-hover'
                                }`}
                        >
                            <File size={12} />
                            Files
                        </button>
                        <button
                            onClick={() => setSearchType('content')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[10px] uppercase font-bold tracking-wider transition-colors ${searchType === 'content'
                                ? 'bg-zinc-700 text-white'
                                : 'bg-bg-elevated text-text-muted hover:text-text-primary hover:bg-state-hover'
                                }`}
                        >
                            <FileText size={12} />
                            Code
                        </button>
                        <button
                            onClick={() => setSearchType('semantic')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[10px] uppercase font-bold tracking-wider transition-colors ${searchType === 'semantic'
                                ? 'bg-purple-600 text-white accent-purple-500' // Use accent check
                                : 'bg-bg-elevated text-text-muted hover:text-text-primary hover:bg-state-hover'
                                } ${searchType === 'semantic' ? '!bg-purple-600' : ''}`} // Ensure purple override wins
                        >
                            <Sparkles size={12} />
                            Semantic
                        </button>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-elegant">
                {searchQuery ? (
                    // Search Results View
                    <div className="pb-4">
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center justify-between sticky top-0 bg-bg-surface/95 backdrop-blur-sm border-b border-border-subtle z-10">
                            <span>Results</span>
                            {isSearching ? <Loader2 className="animate-spin h-3 w-3" /> : <span>{searchResults.length}</span>}
                        </div>

                        {!isSearching && searchResults.length === 0 && (
                            <div className="p-4 text-center text-text-muted text-xs">
                                No matching results
                            </div>
                        )}

                        <div className="divide-y divide-border-subtle/30">
                            {searchResults.map((r, i) => (
                                <div
                                    key={i}
                                    className="group flex flex-col px-3 py-2 hover:bg-state-hover cursor-pointer transition-colors"
                                    onClick={() => onSelect(r.file)}
                                >
                                    <div className="flex items-center gap-2 text-text-primary overflow-hidden">
                                        <File size={12} className="text-text-muted shrink-0" />
                                        <div className="min-w-0 flex flex-col flex-1">
                                            <span className="truncate font-medium text-xs text-sky-500/90 group-hover:text-sky-400" title={r.file}>
                                                <HighlightMatch text={r.file} query={debouncedQuery} />
                                            </span>
                                            {r.score && (
                                                <span className="text-[9px] text-purple-400/80 font-mono mt-0.5">
                                                    Relevance: {(r.score * 100).toFixed(1)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {(r.matchType === 'content' || r.matchType === 'semantic') && r.text && (
                                        <div className="mt-1 pl-5 text-[11px] text-text-secondary font-mono opacity-80 group-hover:opacity-100 line-clamp-2 break-all">
                                            {r.line && (
                                                <span className="text-zinc-500 mr-2 inline-block w-6 text-right select-none border-r border-zinc-700 pr-1">{r.line}</span>
                                            )}
                                            <HighlightMatch text={r.text.substring(0, 200)} query={debouncedQuery} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    // Tree View
                    <>
                        {/* Custom Header with Repo Name */}
                        <div className="px-3 py-2 border-b border-border-subtle">
                            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted flex items-center justify-between mb-0.5">
                                <span>Explorer</span>
                                <button
                                    onClick={() => refreshTree()}
                                    disabled={isRefreshing}
                                    className="p-1 rounded hover:bg-state-hover text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                                    title="Refresh file tree"
                                >
                                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                                </button>
                            </div>
                            {repoName && (
                                <div className="text-xs font-semibold text-text-primary truncate" title={repoName}>
                                    {repoName}
                                </div>
                            )}
                        </div>

                        {loadingTree ? (
                            <div className="p-4 text-xs text-zinc-500">Loading tree...</div>
                        ) : treeError ? (
                            <div className="p-4 text-xs text-red-500">Error: {treeError}</div>
                        ) : (
                            <div className="font-mono">
                                {treeData.map((node) => (
                                    <FileTreeNode
                                        key={node.path}
                                        node={node}
                                        onSelect={onSelect}
                                        level={0}
                                        currentFile={currentFile}
                                        onContextMenu={handleContextMenu}
                                        editingPath={editingPath}
                                        onRenameSubmit={handleRename}
                                        onRenameCancel={handleRenameCancel}
                                        newItemParent={newItemParent}
                                        newItemType={newItemType}
                                        onNewItemSubmit={handleNewItemSubmit}
                                        onNewItemCancel={handleNewItemCancel}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={getContextMenuItems(contextMenu.node)}
                    onClose={closeContextMenu}
                />
            )}

            {/* Delete Confirmation Dialog */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 max-w-sm mx-4 shadow-xl">
                        <h3 className="text-white font-semibold mb-2">Delete {deleteConfirm.isDirectory ? 'Folder' : 'File'}</h3>
                        <p className="text-zinc-300 text-sm mb-4">
                            Are you sure you want to delete <span className="font-mono text-sky-400">{deleteConfirm.name}</span>?
                            {deleteConfirm.isDirectory && (
                                <span className="block mt-1 text-amber-400 text-xs">This will delete all contents inside the folder.</span>
                            )}
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                className="px-3 py-1.5 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
                                onClick={() => setDeleteConfirm(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
                                onClick={() => handleDelete(deleteConfirm)}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
