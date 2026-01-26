
import React, { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
    Background,
    Controls,
    Edge,
    Handle,
    Node,
    Position,
    useEdgesState,
    useNodesState,
    MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { Folder, FileText, Globe } from "lucide-react";

import { RepoGraphNode, RepoGraphEdge } from "@/src/types";

// --- Custom Node Components ---

const CustomNode = ({ data, type }: { data: any, type: string }) => {
    const Icon = type === "directory" ? Folder : type === "root" ? Globe : FileText;
    const isRoot = type === "root";

    return (
        <div className={`
      px-3 py-2 rounded-lg shadow-sm border transaction-all duration-200
      ${isRoot
                ? "bg-zinc-900 border-zinc-700 text-zinc-100 min-w-[120px]"
                : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-400 min-w-[100px]"
            }
    `}>
            <Handle type="target" position={Position.Top} className="!bg-zinc-400" />
            <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${isRoot ? "text-emerald-400" : "text-zinc-400"}`} />
                <span className="text-xs font-medium font-mono truncate max-w-[140px]">
                    {data.label}
                </span>
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-zinc-400" />
        </div>
    );
};

const nodeTypes = {
    directory: CustomNode,
    file: CustomNode,
    root: CustomNode,
};

// --- Layout Helper (Simple Tree) ---

function getLayoutedElements(nodes: RepoGraphNode[], edges: RepoGraphEdge[]) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const childrenMap = new Map<string, string[]>();

    // Build hierarchy
    nodes.forEach((n) => {
        if (n.parentId) {
            if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
            childrenMap.get(n.parentId)?.push(n.id);
        }
    });

    const layoutedNodes: Node[] = [];
    const X_SPACING = 160;
    const Y_SPACING = 100;

    // Recursive layout
    function positionNode(nodeId: string, x: number, y: number): number {
        const node = nodeMap.get(nodeId);
        if (!node) return x;

        const children = childrenMap.get(nodeId) || [];
        let currentX = x;

        // If leaf, just place it.
        if (children.length === 0) {
            layoutedNodes.push({
                id: node.id,
                type: node.type,
                position: { x, y },
                data: { label: node.label },
            });
            return x + X_SPACING;
        }

        // Process children
        let childMinX = x;
        const childXPositions: number[] = [];

        // Center parent above children
        // First, layout all children from left to right
        for (const childId of children) {
            const newX = positionNode(childId, currentX, y + Y_SPACING);
            childXPositions.push(currentX + (newX - currentX) / 2); // Roughly center of child sub-tree
            currentX = newX;
        }

        // Parent X is average of first and last child start/ends? 
        // Simpler: Average of first child's X and last child's X (actual placement)
        // Wait, `positionNode` returns the NEXT available X.
        // The children occupied range [x, currentX].

        // We want to center the parent over the children's range.
        const parentX = (x + currentX - X_SPACING) / 2;

        layoutedNodes.push({
            id: node.id,
            type: node.type,
            position: { x: parentX, y },
            data: { label: node.label },
        });

        return currentX;
    }

    // Find root(s)
    const roots = nodes.filter(n => !n.parentId);
    let startX = 0;
    roots.forEach(root => {
        startX = positionNode(root.id, startX, 0);
    });

    // Convert Edges
    const flowEdges: Edge[] = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a1a1aa' },
        style: { stroke: '#e4e4e7', strokeWidth: 1.5 }
    }));

    return { nodes: layoutedNodes, edges: flowEdges };
}


interface RepoContextGraphProps {
    data: { nodes: RepoGraphNode[]; edges: RepoGraphEdge[] } | null;
    onNodeClick?: (nodeId: string) => void;
}

export function RepoContextGraph({ data, onNodeClick }: RepoContextGraphProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (data) {
            const { nodes: layoutNodes, edges: layoutEdges } = getLayoutedElements(data.nodes, data.edges);
            setNodes(layoutNodes);
            setEdges(layoutEdges);
        }
    }, [data, setNodes, setEdges]);

    // Handle specialized coloring or interactivity if needed
    const onNodeClickInternal = useCallback((event: any, node: Node) => {
        onNodeClick?.(node.id);
    }, [onNodeClick]);

    if (!data || data.nodes.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-zinc-400 bg-zinc-50 border border-dashed border-zinc-200 rounded-lg">
                <div className="text-center">
                    <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No Graph Data. Run Analysis.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full w-full bg-zinc-50 rounded-lg border border-zinc-200 overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClickInternal}
                nodeTypes={nodeTypes as any}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                proOptions={{ hideAttribution: true }}
            >
                <Background gap={16} size={1} color="#e4e4e7" />
                <Controls showInteractive={false} className="!bg-white !border-zinc-200 !shadow-sm" />
            </ReactFlow>
        </div>
    );
}
