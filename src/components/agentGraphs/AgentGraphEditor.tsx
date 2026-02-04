"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { NodeInspector, type AgentNodeEditorValue } from "./NodeInspector";

type AgentGraphDto = {
    _id?: string;
    name: string;
    description?: string;
    execution?: {
        mode?: "dag" | "state_machine";
        entryNodeId?: string;
        maxIterations?: number;
        maxNodeRuns?: number;
    };
    stateDefaults?: Record<string, unknown>;
    nodes: Array<{
        id: string;
        label: string;
        kind?: "react" | "router";
        react: {
            systemPrompt: string;
            userPromptTemplate: string;
            toolNames: string[];
            llmSelection?: { provider: "azure" | "lmstudio"; model?: string };
        };
        output: { schemaId: string; statePath?: string; stateMerge?: boolean };
    }>;
    edges: Array<{ id: string; source: string; target: string; condition?: string }>;
};

// Default tools for new nodes - focused on coding workflows
const DEFAULT_NODE_TOOLS = [
    // File operations
    "list_files",
    "read_file",
    "read_file_range",
    "write_file",
    // Repo + code analysis
    "search_code",
    "repo_metrics",
    "todo_search",
    "dependency_info",
    "describe_structure",
    "git_log",
    "git_diff",
    "git_grep",
    "git_blame",
    "structural_search",
    "symbols_list",
    "find_symbol",
    "go_to_definition",
    "references",
    "find_references",
    "web_search",
    "fetch_url",
    "semantic_code_search",
    "github_api",
    "bootstrap_context",
    "locate_ui_feature",
    "str_replace_editor",
    "execute_bash",
    "output_format",
];

function makeDefaultNode(idx: number) {
    return {
        id: `node-${idx}`,
        label: `Node ${idx}`,
        kind: "react" as const,
        react: {
            systemPrompt: `You are a coding assistant focused on audits, campaigns, runs, and GitHub-centric workflows.

## PRIMARY CAPABILITIES:
- Inspect and modify code in the local repository.
- Analyze diffs, runs, and campaign outputs.
- Use Git tooling to understand history and changes.
- Use GitHub API for repo metadata, issues, and releases.

## WORKING PRINCIPLES:
- Prefer concrete file references and diffs.
- When modifying files, keep changes minimal and explain why.
- Ask for clarification if repo scope or intent is ambiguous.`,
            userPromptTemplate: "Analyze this state and produce the next output.\n\n{{state}}",
            toolNames: DEFAULT_NODE_TOOLS,
            llmSelection: { provider: "azure" as const },
        },
        output: { schemaId: "generic_json" },
    };
}


function normalizeEdges(edges: AgentGraphDto["edges"]) {
    // Ensure deterministic IDs and uniqueness.
    const unique = new Map<string, { id: string; source: string; target: string; condition?: string }>();
    for (const e of edges) {
        const key = `${e.source}=>${e.target}`;
        const existing = unique.get(key);
        unique.set(key, {
            id: `edge-${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            condition: e.condition ?? existing?.condition,
        });
    }
    return Array.from(unique.values());
}

function buildEdgesForTarget(targetId: string, upstreamIds: string[], existingEdges: AgentGraphDto["edges"]) {
    const kept = existingEdges.filter((e) => e.target !== targetId);
    const existingByKey = new Map(existingEdges.map((e) => [`${e.source}=>${e.target}`, e]));
    const added = upstreamIds.map((source) => {
        const existing = existingByKey.get(`${source}=>${targetId}`);
        return {
            id: `edge-${source}-${targetId}`,
            source,
            target: targetId,
            condition: existing?.condition,
        };
    });
    return normalizeEdges([...kept, ...added]);
}

export function AgentGraphEditor({
    graphId,
    initialGraph,
}: {
    graphId: string;
    initialGraph: AgentGraphDto;
}) {
    const [nodes, setNodes] = useState<AgentGraphDto["nodes"]>(() => initialGraph.nodes ?? []);
    const [edges, setEdges] = useState<AgentGraphDto["edges"]>(() => normalizeEdges(initialGraph.edges ?? []));
    const [execution, setExecution] = useState<AgentGraphDto["execution"]>(() => ({
        mode: initialGraph.execution?.mode ?? "dag",
        entryNodeId: initialGraph.execution?.entryNodeId,
        maxIterations: initialGraph.execution?.maxIterations,
        maxNodeRuns: initialGraph.execution?.maxNodeRuns,
    }));
    const [stateDefaults, setStateDefaults] = useState<Record<string, unknown>>(
        () => initialGraph.stateDefaults ?? {}
    );
    const [stateDefaultsRaw, setStateDefaultsRaw] = useState<string>(() =>
        JSON.stringify(initialGraph.stateDefaults ?? {}, null, 2)
    );
    const [stateDefaultsError, setStateDefaultsError] = useState<string>("");
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [saveError, setSaveError] = useState<string>("");

    const latestGraphNameRef = useRef(initialGraph.name);
    const latestGraphDescriptionRef = useRef(initialGraph.description ?? "");

    const selectedNode = useMemo(() => {
        if (!selectedNodeId) return null;
        const n = nodes.find((x) => x.id === selectedNodeId);
        if (!n) return null;
        return {
            id: n.id,
            label: n.label,
            kind: n.kind ?? "react",
            react: n.react,
            output: n.output,
        } satisfies AgentNodeEditorValue;
    }, [nodes, selectedNodeId]);

    const handleAddNode = () => {
        const nextIdx = nodes.length + 1;
        const newNode = makeDefaultNode(nextIdx);
        setNodes((prev) => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
    };

    const handleDeleteNode = (nodeId: string) => {
        setNodes((prev) => prev.filter((n) => n.id !== nodeId));
        setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
        setExecution((prev) =>
            prev?.entryNodeId === nodeId ? { ...prev, entryNodeId: undefined } : prev
        );
        setSelectedNodeId(null);
    };

    const handleUpdateSelectedNode = (next: AgentNodeEditorValue) => {
        setNodes((prev) =>
            prev.map((n) => {
                if (n.id !== next.id) return n;
                return {
                    ...n,
                    label: next.label,
                    kind: next.kind ?? n.kind,
                    react: next.react,
                    output: next.output,
                };
            })
        );
    };

    const selectedUpstream = useMemo(() => {
        if (!selectedNodeId) return [];
        return edges.filter((e) => e.target === selectedNodeId).map((e) => e.source);
    }, [edges, selectedNodeId]);

    const toggleUpstream = (sourceId: string) => {
        if (!selectedNodeId) return;
        if (sourceId === selectedNodeId) return;
        const current = new Set(selectedUpstream);
        if (current.has(sourceId)) current.delete(sourceId);
        else current.add(sourceId);
        setEdges(buildEdgesForTarget(selectedNodeId, Array.from(current), edges));
    };

    const getEdgeCondition = (sourceId: string, targetId: string) => {
        return edges.find((e) => e.source === sourceId && e.target === targetId)?.condition ?? "";
    };

    const updateEdgeCondition = (sourceId: string, targetId: string, condition: string) => {
        const trimmed = condition.trim();
        setEdges((prev) =>
            prev.map((e) => {
                if (e.source !== sourceId || e.target !== targetId) return e;
                return {
                    ...e,
                    condition: trimmed ? trimmed : undefined,
                };
            })
        );
    };

    const saveTimer = useRef<number | null>(null);
    const handleStateDefaultsChange = (raw: string) => {
        setStateDefaultsRaw(raw);
        if (!raw.trim()) {
            setStateDefaults({});
            setStateDefaultsError("");
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                setStateDefaults(parsed as Record<string, unknown>);
                setStateDefaultsError("");
            } else {
                setStateDefaultsError("State defaults must be a JSON object.");
            }
        } catch {
            setStateDefaultsError("Invalid JSON.");
        }
    };

    useEffect(() => {
        // debounce save
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
            void (async () => {
                setSaveState("saving");
                setSaveError("");
                try {
                    const graphNodes = nodes;
                    const graphEdges = normalizeEdges(edges);
                    const payload = {
                        graph: {
                            name: latestGraphNameRef.current,
                            description: latestGraphDescriptionRef.current || undefined,
                            nodes: graphNodes,
                            edges: graphEdges,
                            execution: execution ?? { mode: "dag" },
                            stateDefaults: Object.keys(stateDefaults ?? {}).length ? stateDefaults : undefined,
                        },
                    };
                    const res = await fetch(`/api/agent-graphs/${graphId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        const msg =
                            data?.details && Array.isArray(data.details)
                                ? `${data.error || "Save failed"}: ${data.details.join(", ")}`
                                : data.error || "Save failed";
                        throw new Error(msg);
                    }
                    setSaveState("saved");
                    window.setTimeout(() => setSaveState("idle"), 1200);
                } catch (err: any) {
                    setSaveState("error");
                    setSaveError(err?.message ?? "Failed to save");
                }
            })();
        }, 900);
        return () => {
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
        };
    }, [nodes, edges, execution, stateDefaults, graphId]);

    return (
        <div className="flex h-full min-h-0">
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <input
                                defaultValue={initialGraph.name}
                                onChange={(e) => {
                                    latestGraphNameRef.current = e.target.value;
                                }}
                                className="w-[340px] max-w-full truncate rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm font-semibold text-text-primary"
                            />
                            <div className="text-xs text-text-muted">
                                {saveState === "saving"
                                    ? "Saving…"
                                    : saveState === "saved"
                                        ? "Saved"
                                        : saveState === "error"
                                            ? "Save error"
                                            : " "}
                            </div>
                        </div>
                        <input
                            defaultValue={initialGraph.description ?? ""}
                            onChange={(e) => {
                                latestGraphDescriptionRef.current = e.target.value;
                            }}
                            className="mt-2 w-[520px] max-w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-secondary"
                            placeholder="Description (optional)"
                        />
                        {saveError && <div className="mt-2 text-xs text-rose-400">{saveError}</div>}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleAddNode}>
                            + Add node
                        </Button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-elegant bg-bg-app p-6">
                    <div className="space-y-3">
                        {nodes.map((node) => {
                            const isSelected = node.id === selectedNodeId;
                            const upstreamCount = edges.filter((e) => e.target === node.id).length;
                            const downstreamCount = edges.filter((e) => e.source === node.id).length;
                            return (
                                <button
                                    key={node.id}
                                    onClick={() => setSelectedNodeId(node.id)}
                                    className={`w-full text-left rounded-lg border p-4 transition ${isSelected
                                        ? "border-emerald-500/50 bg-emerald-500/5"
                                        : "border-border-subtle bg-bg-surface hover:bg-state-hover"
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="truncate text-sm font-semibold text-text-primary">
                                                    {node.label}
                                                </div>
                                                <span className="rounded border border-border-subtle bg-bg-elevated px-2 py-0.5 text-[10px] font-mono text-text-muted">
                                                    {node.id}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-text-muted">
                                                <span className="rounded border border-border-subtle bg-bg-elevated px-2 py-0.5">
                                                    tools: {node.react.toolNames?.length ?? 0}
                                                </span>
                                                <span className="rounded border border-border-subtle bg-bg-elevated px-2 py-0.5">
                                                    schema: {node.output.schemaId}
                                                </span>
                                                <span className="rounded border border-border-subtle bg-bg-elevated px-2 py-0.5">
                                                    upstream: {upstreamCount}
                                                </span>
                                                <span className="rounded border border-border-subtle bg-bg-elevated px-2 py-0.5">
                                                    downstream: {downstreamCount}
                                                </span>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                                                selected
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                        {nodes.length === 0 && (
                            <Panel className="p-6 text-center">
                                <div className="text-sm text-text-muted">No nodes yet. Add a node to start.</div>
                            </Panel>
                        )}
                    </div>
                </div>
            </div>

            <div className="w-[420px] shrink-0 border-l border-border-subtle bg-bg-app p-4 overflow-y-auto scrollbar-elegant">
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-text-muted">
                    Inspector
                </div>

                <Panel className="mb-3 space-y-3 p-4">
                    <div className="text-sm font-semibold text-text-primary">Graph settings</div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                Execution mode
                            </label>
                            <select
                                value={execution?.mode ?? "dag"}
                                onChange={(e) =>
                                    setExecution((prev) => ({
                                        ...prev,
                                        mode: e.target.value as "dag" | "state_machine",
                                    }))
                                }
                                className="w-full rounded border-border-subtle bg-bg-surface px-2 py-2 text-sm"
                            >
                                <option value="dag">DAG (static order)</option>
                                <option value="state_machine">State machine (conditional)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                Entry node
                            </label>
                            <select
                                value={execution?.entryNodeId ?? ""}
                                onChange={(e) =>
                                    setExecution((prev) => ({
                                        ...prev,
                                        entryNodeId: e.target.value || undefined,
                                    }))
                                }
                                className="w-full rounded border-border-subtle bg-bg-surface px-2 py-2 text-sm"
                                disabled={(execution?.mode ?? "dag") !== "state_machine"}
                            >
                                <option value="">Auto (roots)</option>
                                {nodes.map((n) => (
                                    <option key={n.id} value={n.id}>
                                        {n.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {(execution?.mode ?? "dag") === "state_machine" && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                    Max iterations
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={execution?.maxIterations ?? ""}
                                    onChange={(e) =>
                                        setExecution((prev) => ({
                                            ...prev,
                                            maxIterations: e.target.value ? Number(e.target.value) : undefined,
                                        }))
                                    }
                                    className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                                    placeholder="200"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                    Max node runs
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={execution?.maxNodeRuns ?? ""}
                                    onChange={(e) =>
                                        setExecution((prev) => ({
                                            ...prev,
                                            maxNodeRuns: e.target.value ? Number(e.target.value) : undefined,
                                        }))
                                    }
                                    className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                                    placeholder="20"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                            State defaults (JSON)
                        </label>
                        <textarea
                            value={stateDefaultsRaw}
                            onChange={(e) => handleStateDefaultsChange(e.target.value)}
                            className="h-28 w-full resize-none rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs font-mono text-text-secondary"
                            placeholder='{"goal":"...","constraints":["..."]}'
                        />
                        {stateDefaultsError && <div className="text-xs text-rose-400">{stateDefaultsError}</div>}
                    </div>
                </Panel>

                <Panel className="mb-3 space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-text-primary">Dependencies</div>
                        <div className="text-xs text-text-muted">Edges are “upstream → this node”</div>
                    </div>
                    {!selectedNodeId ? (
                        <div className="text-sm text-text-muted">Select a node to edit dependencies.</div>
                    ) : (
                        <div className="max-h-56 overflow-y-auto scrollbar-elegant rounded-md border border-border-subtle bg-bg-surface">
                            <div className="divide-y divide-border-subtle">
                                {nodes
                                    .filter((n) => n.id !== selectedNodeId)
                                    .map((n) => {
                                        const checked = selectedUpstream.includes(n.id);
                                        return (
                                            <div key={n.id} className="px-3 py-2 hover:bg-state-hover">
                                                <label className="flex cursor-pointer items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm text-text-primary">{n.label}</div>
                                                        <div className="text-[10px] font-mono text-text-muted">{n.id}</div>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleUpstream(n.id)}
                                                    />
                                                </label>
                                                {checked && (
                                                    <input
                                                        value={getEdgeCondition(n.id, selectedNodeId)}
                                                        onChange={(e) =>
                                                            updateEdgeCondition(n.id, selectedNodeId, e.target.value)
                                                        }
                                                        className="mt-2 w-full rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-[11px] font-mono text-text-secondary"
                                                        placeholder='Condition (e.g. state.nextStep == "debug")'
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                {nodes.length <= 1 && (
                                    <div className="p-3 text-sm text-text-muted">Add more nodes to create edges.</div>
                                )}
                            </div>
                        </div>
                    )}
                </Panel>

                <NodeInspector node={selectedNode} onChange={handleUpdateSelectedNode} onDelete={handleDeleteNode} />

                <Panel className="mt-4 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Notes</div>
                    <div className="mt-1 text-xs text-text-muted">
                        - Nodes can be ReAct or Router.\n
                        - Router nodes skip LLM execution and only route via edge conditions.\n
                        - Node output must be strict JSON.\n
                        - `{"{{state}}"}` injects the current run state JSON.
                    </div>
                </Panel>
            </div>
        </div>
    );
}
