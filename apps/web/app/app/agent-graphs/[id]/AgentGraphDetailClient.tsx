"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlayCircle, Trash2 } from "lucide-react";

import { AgentGraphEditor } from "@kletron/ui/components/agentGraphs/AgentGraphEditor";
import { Button, Skeleton } from "@kletron/ui/components/design-system";

type AgentGraphDto = {
    _id?: string;
    name: string;
    description?: string;
    nodes: any[];
    edges: any[];
    category?: "deep_agent" | "graph" | "automation" | "drift";
};

export default function AgentGraphDetailClient({ params }: { params: { id: string } }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const defaultToolPalette = searchParams?.get("palette") === "work" ? "work" : "code";
    const [graph, setGraph] = useState<AgentGraphDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        void fetchGraph();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);

    const fetchGraph = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/agent-graphs/${params.id}`);
            if (!res.ok) throw new Error("Failed to load graph");
            const data = await res.json();
            setGraph(data.graph);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const handleRun = async () => {
        try {
            const res = await fetch(`/api/agent-graphs/${params.id}/runs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mission: "" }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to start run");
            }
            const data = await res.json();
            router.push(`/app/agent-graphs/${params.id}/runs/${data.runId}`);
        } catch (err: any) {
            alert(err.message || "Failed to start run");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this agent graph?")) return;

        try {
            const res = await fetch(`/api/agent-graphs/${params.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to delete graph");
            }
            router.push("/app/agent-graphs");
        } catch (err: any) {
            alert(err.message || "Failed to delete graph");
        }
    };

    if (loading && !graph) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-[520px] w-full" />
            </div>
        );
    }

    if (error) {
        return <div className="p-6 text-status-error-text">Error: {error}</div>;
    }

    if (!graph) return null;

    return (
        <div className="flex h-[calc(100dvh-3.5rem)] min-h-[28rem] flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-3">
                <div>
                    <div className="text-sm text-text-muted">Agent graph editor</div>
                    <div className="mt-0.5 max-w-xl text-[10px] leading-snug text-text-muted/90">
                        LLM is not configured on nodes. Use the Agent composer or automation stages for chat and
                        scheduled runs; use Run here with defaults from Configuration → LLM.
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="danger" onClick={() => void handleDelete()}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </Button>
                    <Button onClick={() => void handleRun()}>
                        <PlayCircle className="h-4 w-4" />
                        Run
                    </Button>
                </div>
            </div>

            <div className="min-h-0 flex-1">
                <AgentGraphEditor
                    graphId={params.id}
                    initialGraph={graph as any}
                    defaultToolPalette={defaultToolPalette}
                />
            </div>
        </div>
    );
}
