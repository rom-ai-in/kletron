'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  File,
  Cog,
  Plus,
  Minus,
  Undo2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GitChangeStatus = 'modified' | 'created' | 'deleted' | 'renamed' | 'untracked';

export interface GitFileChangeItem {
  path: string;
  status: GitChangeStatus;
  from?: string;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  file?: GitFileChangeItem;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusColor(status: GitChangeStatus): string {
  switch (status) {
    case 'modified': return 'text-yellow-400';
    case 'created': return 'text-green-400';
    case 'untracked': return 'text-green-400';
    case 'deleted': return 'text-red-400';
    case 'renamed': return 'text-blue-400';
    default: return 'text-text-secondary';
  }
}

function getStatusIndicator(status: GitChangeStatus): string {
  switch (status) {
    case 'modified': return 'M';
    case 'created': return 'A';
    case 'untracked': return 'U';
    case 'deleted': return 'D';
    case 'renamed': return 'R';
    default: return '?';
  }
}

function getStatusDotColor(status: GitChangeStatus): string {
  switch (status) {
    case 'modified': return 'bg-yellow-400';
    case 'created': return 'bg-green-400';
    case 'untracked': return 'bg-green-400/60';
    case 'deleted': return 'bg-red-400';
    case 'renamed': return 'bg-blue-400';
    default: return 'bg-text-muted';
  }
}

function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': case 'js': case 'jsx':
      return <FileCode className="w-3.5 h-3.5 text-status-info-text" />;
    case 'json':
      return <FileJson className="w-3.5 h-3.5 text-status-warning-text" />;
    case 'md': case 'txt':
      return <FileText className="w-3.5 h-3.5 text-text-secondary" />;
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg':
      return <FileImage className="w-3.5 h-3.5 text-status-success-text" />;
    case 'css': case 'scss':
      return <FileCode className="w-3.5 h-3.5 text-violet-400" />;
    case 'yaml': case 'yml': case 'config':
      return <Cog className="w-3.5 h-3.5 text-text-muted" />;
    default:
      return <File className="w-3.5 h-3.5 text-text-secondary" />;
  }
}

/** Build a hierarchical tree from a flat list of file paths */
function buildTree(files: GitFileChangeItem[]): TreeNode[] {
  const root: Map<string, TreeNode> = new Map();

  for (const file of files) {
    const parts = file.path.split('/');
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!currentLevel.has(part)) {
        const node: TreeNode = {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          children: [],
          file: isLast ? file : undefined,
        };
        currentLevel.set(part, node);
      }

      const node = currentLevel.get(part)!;
      if (!isLast) {
        // Convert node children array to a map for navigation
        const childMap = new Map<string, TreeNode>();
        for (const child of node.children) {
          childMap.set(child.name, child);
        }
        // Process next level
        const nextPart = parts[i + 1];
        const nextPath = parts.slice(0, i + 2).join('/');
        const nextIsLast = i + 1 === parts.length - 1;

        if (!childMap.has(nextPart)) {
          const childNode: TreeNode = {
            name: nextPart,
            path: nextPath,
            isDirectory: !nextIsLast,
            children: [],
            file: nextIsLast ? file : undefined,
          };
          node.children.push(childNode);
          childMap.set(nextPart, childNode);
        } else if (nextIsLast) {
          // Update existing leaf node with file data
          childMap.get(nextPart)!.file = file;
        }
        // Skip to inner level via childMap next iteration
        currentLevel = childMap;
        // Skip the next iteration since we already processed it
        i++;
      }
    }
  }

  // Sort: directories first, then alphabetical
  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .map(n => ({ ...n, children: sortNodes(n.children) }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  return sortNodes(Array.from(root.values()));
}

/** Flatten single-child directory chains (e.g. "src/components" instead of src > components) */
function compactTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.map(node => {
    if (node.isDirectory && node.children.length === 1 && node.children[0].isDirectory) {
      const child = node.children[0];
      const merged: TreeNode = {
        ...child,
        name: `${node.name}/${child.name}`,
        children: compactTree(child.children),
      };
      return merged;
    }
    return { ...node, children: compactTree(node.children) };
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GitChangeTreeProps {
  files: GitFileChangeItem[];
  /** Type of section: determines which actions to show */
  section: 'staged' | 'unstaged';
  selectedPath?: string | null;
  onFileClick?: (file: GitFileChangeItem) => void;
  onStageFile?: (path: string) => void;
  onUnstageFile?: (path: string) => void;
  onRevertFile?: (path: string) => void;
  className?: string;
}

// ── Tree Node Component ───────────────────────────────────────────────────────

function TreeItem({
  node,
  depth,
  section,
  selectedPath,
  expandedPaths,
  onToggle,
  onFileClick,
  onStageFile,
  onUnstageFile,
  onRevertFile,
}: {
  node: TreeNode;
  depth: number;
  section: 'staged' | 'unstaged';
  selectedPath?: string | null;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onFileClick?: (file: GitFileChangeItem) => void;
  onStageFile?: (path: string) => void;
  onUnstageFile?: (path: string) => void;
  onRevertFile?: (path: string) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const paddingLeft = depth * 14 + 6;

  if (node.isDirectory) {
    // Count files in subtree
    function countFiles(n: TreeNode): number {
      if (!n.isDirectory) return 1;
      return n.children.reduce((sum, c) => sum + countFiles(c), 0);
    }
    const fileCount = countFiles(node);

    return (
      <>
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className="flex w-full items-center gap-1 py-0.5 text-[11px] text-text-secondary hover:bg-state-hover transition-colors group"
          style={{ paddingLeft }}
        >
          {isExpanded
            ? <ChevronDown className="h-2.5 w-2.5 text-text-muted flex-shrink-0" />
            : <ChevronRight className="h-2.5 w-2.5 text-text-muted flex-shrink-0" />
          }
          {isExpanded
            ? <FolderOpen className="h-3 w-3 text-status-warning-text flex-shrink-0" />
            : <Folder className="h-3 w-3 text-status-warning-text flex-shrink-0" />
          }
          <span className="truncate font-mono">{node.name}</span>
          <span className="ml-auto text-[9px] text-text-muted pr-1">{fileCount}</span>
        </button>
        {isExpanded && node.children.map(child => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            section={section}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths}
            onToggle={onToggle}
            onFileClick={onFileClick}
            onStageFile={onStageFile}
            onUnstageFile={onUnstageFile}
            onRevertFile={onRevertFile}
          />
        ))}
      </>
    );
  }

  // File node
  const file = node.file!;
  return (
    <div
      className={`flex items-center gap-1 py-0.5 text-[11px] transition-colors group cursor-pointer ${
        isSelected
          ? 'bg-state-active text-text-primary'
          : 'text-text-secondary hover:bg-state-hover'
      }`}
      style={{ paddingLeft }}
      onClick={() => onFileClick?.(file)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onFileClick?.(file); }}
    >
      {/* Spacer for alignment with folder chevrons */}
      <span className="w-2.5 flex-shrink-0" />
      {/* File icon */}
      <span className="flex-shrink-0">{getFileIcon(node.name)}</span>
      {/* Filename */}
      <span className="truncate font-mono flex-1">{node.name}</span>
      {/* Per-file actions (on hover) */}
      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pr-1">
        {section === 'unstaged' && onStageFile && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStageFile(file.path); }}
            className="p-0.5 rounded text-text-muted hover:text-green-400 hover:bg-green-400/10 transition-colors"
            title="Stage file"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
        {section === 'unstaged' && onRevertFile && file.status !== 'untracked' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRevertFile(file.path); }}
            className="p-0.5 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Discard changes"
          >
            <Undo2 className="h-3 w-3" />
          </button>
        )}
        {section === 'staged' && onUnstageFile && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUnstageFile(file.path); }}
            className="p-0.5 rounded text-text-muted hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
            title="Unstage file"
          >
            <Minus className="h-3 w-3" />
          </button>
        )}
      </span>
      {/* Status indicator */}
      <span className={`text-[9px] font-bold w-3 text-right flex-shrink-0 pr-1 ${getStatusColor(file.status)}`}>
        {getStatusIndicator(file.status)}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GitChangeTree({
  files,
  section,
  selectedPath,
  onFileClick,
  onStageFile,
  onUnstageFile,
  onRevertFile,
  className = '',
}: GitChangeTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Build and compact the tree
  const tree = useMemo(() => {
    const raw = buildTree(files);
    return compactTree(raw);
  }, [files]);

  // Auto-expand all directories on mount / when files change
  useMemo(() => {
    const allDirs = new Set<string>();
    function collectDirs(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (node.isDirectory) {
          allDirs.add(node.path);
          collectDirs(node.children);
        }
      }
    }
    collectDirs(tree);
    setExpandedPaths(allDirs);
  }, [tree]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className={`py-0.5 ${className}`}>
      {tree.map(node => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          section={section}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          onToggle={handleToggle}
          onFileClick={onFileClick}
          onStageFile={onStageFile}
          onUnstageFile={onUnstageFile}
          onRevertFile={onRevertFile}
        />
      ))}
    </div>
  );
}
