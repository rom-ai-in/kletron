'use client';

import React, { useState, useCallback } from 'react';
import {
    ChevronRight, ChevronDown, File, Folder, FolderOpen,
    FileCode, FileJson, FileText, FileImage, Cog, Package
} from 'lucide-react';

export interface FileTreeNode {
    id: string;
    name: string;
    type: 'file' | 'folder';
    children?: FileTreeNode[];
    icon?: React.ReactNode;
    metadata?: Record<string, unknown>;
}

export interface FileTreeProps {
    nodes: FileTreeNode[];
    selectedId?: string;
    expandedIds?: string[];
    onSelect?: (node: FileTreeNode) => void;
    onExpand?: (nodeId: string, expanded: boolean) => void;
    onContextMenu?: (e: React.MouseEvent, node: FileTreeNode) => void;
    className?: string;
}

// Get appropriate icon based on file extension
function getFileIcon(filename: string): React.ReactNode {
    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
        case 'ts':
        case 'tsx':
        case 'js':
        case 'jsx':
            return <FileCode className="w-4 h-4 text-status-info-text" />;
        case 'json':
            return <FileJson className="w-4 h-4 text-status-warning-text" />;
        case 'md':
        case 'txt':
            return <FileText className="w-4 h-4 text-text-secondary" />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
            return <FileImage className="w-4 h-4 text-status-success-text" />;
        case 'css':
        case 'scss':
            return <FileCode className="w-4 h-4 text-violet-400" />;
        case 'config':
        case 'yaml':
        case 'yml':
            return <Cog className="w-4 h-4 text-text-muted" />;
        default:
            return <File className="w-4 h-4 text-text-secondary" />;
    }
}

interface TreeNodeItemProps {
    node: FileTreeNode;
    depth: number;
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: (node: FileTreeNode) => void;
    onToggle: (nodeId: string) => void;
    onContextMenu?: (e: React.MouseEvent, node: FileTreeNode) => void;
    expandedIds: Set<string>;
    selectedId?: string;
}

function TreeNodeItem({
    node,
    depth,
    isSelected,
    isExpanded,
    onSelect,
    onToggle,
    onContextMenu,
    expandedIds,
    selectedId
}: TreeNodeItemProps) {
    const isFolder = node.type === 'folder';
    const paddingLeft = depth * 12 + 8;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) {
            onToggle(node.id);
        }
        onSelect(node);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        onContextMenu?.(e, node);
    };

    return (
        <>
            <div
                role="treeitem"
                aria-selected={isSelected}
                aria-expanded={isFolder ? isExpanded : undefined}
                tabIndex={0}
                className={`flex items-center gap-1 py-1 cursor-pointer transition-colors group ${isSelected
                        ? 'bg-state-active text-text-primary'
                        : 'text-text-primary hover:bg-state-hover'
                    }`}
                style={{ paddingLeft }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick(e as any);
                    }
                }}
            >
                {/* Expand/Collapse chevron */}
                <span className="w-4 h-4 flex items-center justify-center">
                    {isFolder && (
                        isExpanded
                            ? <ChevronDown className="w-3 h-3 text-text-muted" />
                            : <ChevronRight className="w-3 h-3 text-text-muted" />
                    )}
                </span>

                {/* Icon */}
                <span className="w-4 h-4 flex items-center justify-center">
                    {node.icon || (
                        isFolder
                            ? (isExpanded
                                ? <FolderOpen className="w-4 h-4 text-status-warning-text" />
                                : <Folder className="w-4 h-4 text-status-warning-text" />)
                            : getFileIcon(node.name)
                    )}
                </span>

                {/* Name */}
                <span className="text-xs truncate flex-1">{node.name}</span>
            </div>

            {/* Children */}
            {isFolder && isExpanded && node.children && (
                <div role="group">
                    {node.children.map(child => (
                        <TreeNodeItem
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            isSelected={selectedId === child.id}
                            isExpanded={expandedIds.has(child.id)}
                            onSelect={onSelect}
                            onToggle={onToggle}
                            onContextMenu={onContextMenu}
                            expandedIds={expandedIds}
                            selectedId={selectedId}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

export function FileTree({
    nodes,
    selectedId,
    expandedIds: controlledExpandedIds,
    onSelect,
    onExpand,
    onContextMenu,
    className = '',
}: FileTreeProps) {
    const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set());

    // Use controlled or internal state
    const expandedSet = controlledExpandedIds
        ? new Set(controlledExpandedIds)
        : internalExpanded;

    const handleToggle = useCallback((nodeId: string) => {
        const newExpanded = !expandedSet.has(nodeId);

        if (onExpand) {
            onExpand(nodeId, newExpanded);
        } else {
            setInternalExpanded(prev => {
                const next = new Set(prev);
                if (newExpanded) {
                    next.add(nodeId);
                } else {
                    next.delete(nodeId);
                }
                return next;
            });
        }
    }, [expandedSet, onExpand]);

    const handleSelect = useCallback((node: FileTreeNode) => {
        onSelect?.(node);
    }, [onSelect]);

    return (
        <div role="tree" aria-label="File tree" className={`py-1 overflow-y-auto scrollbar-elegant ${className}`}>
            {nodes.map(node => (
                <TreeNodeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    isSelected={selectedId === node.id}
                    isExpanded={expandedSet.has(node.id)}
                    onSelect={handleSelect}
                    onToggle={handleToggle}
                    onContextMenu={onContextMenu}
                    expandedIds={expandedSet}
                    selectedId={selectedId}
                />
            ))}
        </div>
    );
}

// Helper to create tree nodes from a flat file list
export function createFileTree(files: string[]): FileTreeNode[] {
    const root: Record<string, FileTreeNode> = {};

    files.forEach(path => {
        const parts = path.split('/').filter(Boolean);
        let current = root;

        parts.forEach((part, i) => {
            const isLast = i === parts.length - 1;
            const id = parts.slice(0, i + 1).join('/');

            if (!current[part]) {
                current[part] = {
                    id,
                    name: part,
                    type: isLast ? 'file' : 'folder',
                    children: isLast ? undefined : [],
                };
            }

            if (!isLast && current[part].children) {
                const childMap: Record<string, FileTreeNode> = {};
                current[part].children!.forEach(c => { childMap[c.name] = c; });
                current = childMap as any;
                current[part] = current[part] || {
                    id: parts.slice(0, i + 2).join('/'),
                    name: parts[i + 1],
                    type: i + 1 === parts.length - 1 ? 'file' : 'folder',
                    children: i + 1 === parts.length - 1 ? undefined : [],
                };
            }
        });
    });

    return Object.values(root);
}
