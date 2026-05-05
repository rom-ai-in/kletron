// apps/web/components/FileTree.tsx
"use client";

import { useState } from "react";
import { ChevronRight, Folder, FileText } from "lucide-react";

interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: TreeNode[];
}

interface FileTreeProps {
  workspace: string;
}

export function FileTree({ workspace: _workspace }: FileTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Mock file tree data
  const mockFileTree: TreeNode[] = [
    {
      id: "src",
      name: "src",
      type: "folder",
      path: "src",
      children: [
        {
          id: "components",
          name: "components",
          type: "folder",
          path: "src/components",
          children: [
            { id: "Button.tsx", name: "Button.tsx", type: "file", path: "src/components/Button.tsx" },
            { id: "Card.tsx", name: "Card.tsx", type: "file", path: "src/components/Card.tsx" }
          ]
        },
        {
          id: "pages",
          name: "pages",
          type: "folder",
          path: "src/pages",
          children: [
            { id: "Home.tsx", name: "Home.tsx", type: "file", path: "src/pages/Home.tsx" },
            { id: "About.tsx", name: "About.tsx", type: "file", path: "src/pages/About.tsx" }
          ]
        },
        { id: "index.ts", name: "index.ts", type: "file", path: "src/index.ts" },
        { id: "main.tsx", name: "main.tsx", type: "file", path: "src/main.tsx" }
      ]
    },
    {
      id: "public",
      name: "public",
      type: "folder",
      path: "public",
      children: [
        { id: "index.html", name: "index.html", type: "file", path: "public/index.html" },
        { id: "favicon.ico", name: "favicon.ico", type: "file", path: "public/favicon.ico" }
      ]
    },
    { id: "package.json", name: "package.json", type: "file", path: "package.json" },
    { id: "tsconfig.json", name: "tsconfig.json", type: "file", path: "tsconfig.json" }
  ];

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
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div key={node.id} style={{ marginLeft: `${depth * 16}px` }}>
        <div className="flex items-center py-1">
          {hasChildren && (
            <button
              onClick={() => toggleNode(node.id)}
              className="p-1 hover:bg-surface rounded mr-1"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`} />
            </button>
          )}

          {node.type === "folder" ? (
            <Folder className="w-4 h-4 mr-2 text-blue-500" />
          ) : (
            <FileText className="w-4 h-4 mr-2 text-gray-600" />
          )}

          <span className={`text-sm ${node.type === 'file' ? 'text-foreground' : 'font-medium text-blue-700'}`}>
            {node.name}
          </span>
        </div>

        {hasChildren && isExpanded && node.children && (
          <div className="mt-1">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-surface border-r border-border">
      <div className="p-3 border-b border-border font-medium text-foreground">Files</div>
      <div className="p-2">
        {mockFileTree.map(node => renderTreeNode(node))}
      </div>
    </div>
  );
}
