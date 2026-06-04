"use client";

import { useState, useEffect } from "react";
import { Folder, File, ChevronRight, ChevronDown } from "lucide-react";

interface TreeNode {
    id: string;
    name: string;
    type: 'file' | 'directory';
    path: string;
    children?: TreeNode[];
}

interface FileTreeProps {
    workspace: string;
}

export function FileTree({ workspace: _workspace }: FileTreeProps) {
    const [treeData, setTreeData] = useState<TreeNode[]>([]);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // Mock data - in production this would come from the MCP server or file system API
    useEffect(() => {
        const mockData: TreeNode[] = [
            {
                id: 'src',
                name: 'src',
                type: 'directory',
                path: 'src',
                children: [
                    {
                        id: 'components',
                        name: 'components',
                        type: 'directory',
                        path: 'src/components',
                        children: [
                            { id: 'Button.tsx', name: 'Button.tsx', type: 'file', path: 'src/components/Button.tsx' },
                            { id: 'Card.tsx', name: 'Card.tsx', type: 'file', path: 'src/components/Card.tsx' }
                        ]
                    },
                    {
                        id: 'pages',
                        name: 'pages',
                        type: 'directory',
                        path: 'src/pages',
                        children: [
                            { id: 'Home.tsx', name: 'Home.tsx', type: 'file', path: 'src/pages/Home.tsx' },
                            { id: '_app.tsx', name: '_app.tsx', type: 'file', path: 'src/pages/_app.tsx' }
                        ]
                    }
                ]
            },
            {
                id: 'package.json',
                name: 'package.json',
                type: 'file',
                path: 'package.json'
            },
            {
                id: 'tsconfig.json',
                name: 'tsconfig.json',
                type: 'file',
                path: 'tsconfig.json'
            }
        ];

        setTreeData(mockData);
    }, []);

    const toggleNode = (nodeId: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId);
        } else {
            newExpanded.add(nodeId);
        }
        setExpandedNodes(newExpanded);
    };

    const renderTreeNode = (node: TreeNode, depth: number = 0) => {
        if (node.type === 'file') {
            return (
                <div key={node.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface rounded">
                    <File className="w-4 h-4 text-subtle" />
                    <span className="truncate">{node.name}</span>
                </div>
            );
        }

        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.has(node.id);

        return (
            <div key={node.id} className="relative">
                <button
                    onClick={() => toggleNode(node.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface rounded focus:outline-none"
                >
                    {hasChildren && (
                        isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-subtle" />
                        ) : (
                            <ChevronRight className="w-4 h-4 text-subtle" />
                        )
                    )}
                    {!hasChildren && <Folder className="w-4 h-4 text-subtle" />}
                    <span className="truncate font-medium">{node.name}</span>
                </button>

                {isExpanded && hasChildren && (
                    <div className="ml-4 mt-1">
                        {node.children?.map(child => renderTreeNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto bg-surface border-r border-border">
            <div className="p-3 font-medium text-sm border-b border-subtle">Files</div>
            <div className="py-2">
                {treeData.map(node => renderTreeNode(node))}
            </div>
        </div>
    );
}