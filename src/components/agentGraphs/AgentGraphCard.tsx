"use client";

import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";

type AgentGraphSummary = {
    _id?: string;
    name: string;
    description?: string;
    updatedAt?: string;
    nodes?: any[];
};

export function AgentGraphCard({
    graph,
    onView,
    onDelete,
}: {
    graph: AgentGraphSummary;
    onView?: () => void;
    onDelete?: () => void;
}) {
    return (
        <Panel className="group p-4 transition hover:border-border-strong hover:bg-state-hover">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-text-primary">{graph.name}</h3>
                        <span className="rounded border border-border-subtle bg-bg-elevated px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                            agent-graph
                        </span>
                    </div>
                    {graph.description && (
                        <p className="text-sm text-text-muted line-clamp-2">{graph.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                        <span>{Array.isArray(graph.nodes) ? graph.nodes.length : 0} nodes</span>
                        {graph.updatedAt && (
                            <span>updated {new Date(graph.updatedAt).toLocaleString()}</span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={onView}>
                        Open
                    </Button>
                    {onDelete && (
                        <Button
                            size="sm"
                            variant="danger"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Delete this agent graph?")) onDelete();
                            }}
                        >
                            Delete
                        </Button>
                    )}
                </div>
            </div>
        </Panel>
    );
}

