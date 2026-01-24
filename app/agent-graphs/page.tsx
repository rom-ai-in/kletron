"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { Panel } from "@/src/components/ui/Panel";
import { AgentGraphCard } from "@/src/components/agentGraphs/AgentGraphCard";

type AgentGraphSummary = {
    _id?: string;
    name: string;
    description?: string;
    updatedAt?: string;
    nodes?: any[];
};

function defaultGraphPayload() {
    return {
        graph: {
            name: "New Agent Graph",
            description: "All nodes are ReAct agents. Outputs must be strict JSON.",
            nodes: [
                {
                    id: "node-1",
                    label: "Node 1",
                    react: {
                        systemPrompt: "You are a helpful ReAct agent. Use tools as needed. Output strict JSON only.",
                        userPromptTemplate: "Analyze this state and produce the next output.\n\n{{state}}",
                        toolNames: ["list_files", "read_file", "search_code"],
                        llmSelection: { provider: "azure" },
                    },
                    output: { schemaId: "generic_json" },
                },
            ],
            edges: [],
        },
    };
}

export default function AgentGraphsPage() {
    const router = useRouter();
    const [graphs, setGraphs] = useState<AgentGraphSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        void fetchGraphs();
    }, []);

    const fetchGraphs = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/agent-graphs");
            if (!res.ok) throw new Error("Failed to load graphs");
            const data = await res.json();
            setGraphs(data.graphs || []);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const filtered = graphs.filter((g) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            g.name.toLowerCase().includes(q) ||
            (g.description ?? "").toLowerCase().includes(q)
        );
    });

    const handleCreate = async () => {
        try {
            const res = await fetch("/api/agent-graphs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(defaultGraphPayload()),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to create graph");
            }
            const data = await res.json();
            router.push(`/agent-graphs/${data.graphId}`);
        } catch (err: any) {
            alert(err.message || "Failed to create graph");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/agent-graphs/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to delete graph");
            }
            void fetchGraphs();
        } catch (err: any) {
            alert(err.message || "Failed to delete graph");
        }
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <Layers className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Agent Graphs</h1>
                        <p className="text-sm text-text-muted">DAG editor where every node is a ReAct agent</p>
                    </div>
                </div>
                <Button onClick={() => void handleCreate()}>+ New Agent Graph</Button>
            </div>

            <div className="flex items-center gap-4 border-b border-border-subtle bg-bg-surface px-6 py-3">
                <input
                    type="text"
                    placeholder="Search graphs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring"
                />
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-elegant p-6">
                {loading && (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-3 flex-1">
                                        <Skeleton className="h-5 w-48" />
                                        <Skeleton className="h-4 w-3/4" />
                                        <div className="flex gap-4 pt-1">
                                            <Skeleton className="h-3 w-24" />
                                            <Skeleton className="h-3 w-32" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Skeleton className="h-8 w-16" />
                                        <Skeleton className="h-8 w-16" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300">
                        Error: {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="space-y-4">
                        {filtered.map((graph) => (
                            <AgentGraphCard
                                key={graph._id}
                                graph={graph}
                                onView={() => router.push(`/agent-graphs/${graph._id}`)}
                                onDelete={() => graph._id && void handleDelete(graph._id)}
                            />
                        ))}

                        {filtered.length === 0 && (
                            <Panel className="flex h-64 items-center justify-center">
                                <div className="text-center">
                                    <p className="text-sm text-text-muted">
                                        {searchQuery ? "No graphs match your search" : "No agent graphs yet"}
                                    </p>
                                    <p className="mt-2 text-xs text-text-muted">
                                        Create a new agent graph to start composing ReAct nodes.
                                    </p>
                                </div>
                            </Panel>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

