"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { WORK_MODE_TOOL_ALLOWLIST } from "@kletron/shared/workMode";

import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { NodeInspector, type AgentNodeEditorValue } from "./NodeInspector";

type AgentGraphDto = {
    _id?: string;
    name: string;
    description?: string;
    execution?: {
        mode?: "dag";
        maxIterations?: number;
        maxNodeRuns?: number;
    };
    subagent?: {
        key: string;
        whenToUse: string;
        selectable?: boolean;
        readOnly?: boolean;
        allowExec?: boolean;
        maxSteps?: number;
    };
    stateDefaults?: Record<string, unknown>;
    nodes: Array<{
        id: string;
        label: string;
        kind?: "react";
        react: {
            systemPrompt: string;
            userPromptTemplate: string;
            toolNames: string[];
            skillIds?: string[];
        };
        output: { schemaId: string; statePath?: string; stateMerge?: boolean };
    }>;
    edges: Array<{ id: string; source: string; target: string }>;
};

// Default tools for new nodes - focused on coding workflows
const DEFAULT_NODE_TOOLS = [
    // File operations
    "glob_files",
    "list_files",
    "read_file",
    "read_file_range",
    "write_file",
    "str_replace_editor",
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
    "web_search",
    "fetch_url",
    "semantic_code_search",
    "github_api",
    "bootstrap_context",
    "locate_ui_feature",
    "execute_bash",
    "output_format",
    "write_todos",
];

const DEFAULT_WORK_NODE_TOOLS = [...WORK_MODE_TOOL_ALLOWLIST];

const CODE_NODE_DEFAULT_PROMPT = `You are a coding assistant focused on code changes, debugging, and GitHub-centric workflows.

## PRIMARY CAPABILITIES:
- Inspect and modify code in the local repository.
- Analyze diffs and recent changes.
- Use Git tooling to understand history and changes.
- Use GitHub API for repo metadata, issues, and releases.

## WORKING PRINCIPLES:
- Prefer concrete file references and diffs.
- When modifying files, keep changes minimal and explain why.
- Ask for clarification if repo scope or intent is ambiguous.`;

const WORK_NODE_DEFAULT_PROMPT = `You are an assistant for general work in the user's workspace: writing, research, planning, and files on disk.

Prefer clear, concise answers. Use read/search/write tools when they help. Avoid assuming a deep repository dive unless the user asks for code focus.

When saving files, use paths relative to the workspace root.`;

function makeDefaultNode(idx: number, palette: "code" | "work" = "code") {
    const toolNames = palette === "work" ? DEFAULT_WORK_NODE_TOOLS : DEFAULT_NODE_TOOLS;
    const systemPrompt = palette === "work" ? WORK_NODE_DEFAULT_PROMPT : CODE_NODE_DEFAULT_PROMPT;
    return {
        id: `node-${idx}`,
        label: `Node ${idx}`,
        kind: "react" as const,
        react: {
            systemPrompt,
            userPromptTemplate: "Analyze this state and produce the next output.\n\n{{state}}",
            toolNames,
            skillIds: [],
        },
        output: { schemaId: "generic_json" },
    };
}


function normalizeEdges(edges: AgentGraphDto["edges"]) {
    // Ensure deterministic IDs and uniqueness.
    const unique = new Map<string, { id: string; source: string; target: string }>();
    for (const e of edges) {
        const key = `${e.source}=>${e.target}`;
        unique.set(key, {
            id: `edge-${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
        });
    }
    return Array.from(unique.values());
}

function buildEdgesForTarget(targetId: string, upstreamIds: string[], existingEdges: AgentGraphDto["edges"]) {
    const kept = existingEdges.filter((e) => e.target !== targetId);
    const added = upstreamIds.map((source) => ({
        id: `edge-${source}-${targetId}`,
        source,
        target: targetId,
    }));
    return normalizeEdges([...kept, ...added]);
}

export function AgentGraphEditor({
    graphId,
    initialGraph,
    apiFetch,
    defaultToolPalette = "code",
}: {
    graphId: string;
    initialGraph: AgentGraphDto;
    /** When set (e.g. Electron), used instead of global `fetch` for save/reset. */
    apiFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    /** New nodes use Code-style tools (full repo/git/bash) or Work-mode allowlist (shared `WORK_MODE_TOOL_ALLOWLIST`). */
    defaultToolPalette?: "code" | "work";
}) {
    const request = useMemo(
        () => apiFetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)),
        [apiFetch],
    );
    const [nodes, setNodes] = useState<AgentGraphDto["nodes"]>(() => initialGraph.nodes ?? []);
    const [edges, setEdges] = useState<AgentGraphDto["edges"]>(() => normalizeEdges(initialGraph.edges ?? []));
    const [execution, setExecution] = useState<AgentGraphDto["execution"]>(() => ({
        mode: "dag",
        maxIterations: initialGraph.execution?.maxIterations,
        maxNodeRuns: initialGraph.execution?.maxNodeRuns,
    }));
    const [subagent, setSubagent] = useState<AgentGraphDto["subagent"]>(() => initialGraph.subagent);
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
        const react = { ...n.react };
        delete (react as { llmSelection?: unknown }).llmSelection;
        return {
            id: n.id,
            label: n.label,
            kind: n.kind ?? "react",
            react,
            output: n.output,
        } satisfies AgentNodeEditorValue;
    }, [nodes, selectedNodeId]);

    const handleAddNode = () => {
        const nextIdx = nodes.length + 1;
        const newNode = makeDefaultNode(nextIdx, defaultToolPalette);
        setNodes((prev) => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
    };

    const handleDeleteNode = (nodeId: string) => {
        setNodes((prev) => prev.filter((n) => n.id !== nodeId));
        setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
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
                    const graphNodes = nodes.map((n) => {
                        const react = { ...n.react };
                        delete (react as { llmSelection?: unknown }).llmSelection;
                        return { ...n, react };
                    });
                    const graphEdges = normalizeEdges(edges);
                    const payload = {
                        graph: {
                            name: latestGraphNameRef.current,
                            description: latestGraphDescriptionRef.current || undefined,
                            nodes: graphNodes,
                            edges: graphEdges,
                            execution: execution ?? { mode: "dag" },
                            subagent: subagent?.key ? subagent : undefined,
                            stateDefaults: Object.keys(stateDefaults ?? {}).length ? stateDefaults : undefined,
                        },
                    };
                    const res = await request(`/api/agent-graphs/${graphId}`, {
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
    }, [nodes, edges, execution, subagent, stateDefaults, graphId, request]);

    const handleResetToDefault = async () => {
        if (!confirm("Reset all nodes to default prompts and tools? This cannot be undone.")) return;
        try {
            const res = await request(`/api/agent-graphs/${graphId}/reset`, { method: "POST" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to reset");
            }
            const data = await res.json();
            if (data.graph) {
                setNodes(data.graph.nodes ?? []);
                setEdges(normalizeEdges(data.graph.edges ?? []));
                if (data.graph.execution) setExecution(data.graph.execution);
                setSubagent(data.graph.subagent);
            }
        } catch (err: any) {
            alert(err.message || "Failed to reset to default");
        }
    };

    const patchSubagent = (patch: Partial<NonNullable<AgentGraphDto["subagent"]>>) =>
        setSubagent((prev) => ({
            key: prev?.key ?? "",
            whenToUse: prev?.whenToUse ?? "",
            ...prev,
            ...patch,
        }));

    const graphSettingsFields = (
        <>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        Max node executions
                    </label>
                    <input
                        type="number"
                        min={1}
                        value={execution?.maxIterations ?? ""}
                        onChange={(e) =>
                            setExecution((prev) => ({
                                ...prev,
                                mode: "dag",
                                maxIterations: e.target.value ? Number(e.target.value) : undefined,
                            }))
                        }
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                        placeholder="200"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        Max runs per node
                    </label>
                    <input
                        type="number"
                        min={1}
                        value={execution?.maxNodeRuns ?? ""}
                        onChange={(e) =>
                            setExecution((prev) => ({
                                ...prev,
                                mode: "dag",
                                maxNodeRuns: e.target.value ? Number(e.target.value) : undefined,
                            }))
                        }
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                        placeholder="20"
                    />
                </div>
            </div>

            <div className="space-y-2 rounded-md border border-border-subtle bg-bg-elevated/60 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    Subagent
                </div>
                <p className="text-[11px] leading-snug text-text-muted">
                    Give this graph a key to make it callable by other agents through the{" "}
                    <span className="font-mono text-text-secondary">task</span> tool. Subagents run with an
                    isolated context window and are read-only.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                            Key (kebab-case)
                        </label>
                        <input
                            value={subagent?.key ?? ""}
                            onChange={(e) => patchSubagent({ key: e.target.value.trim() })}
                            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm font-mono text-text-primary"
                            placeholder="repo-cartographer"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                            Max steps
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={subagent?.maxSteps ?? ""}
                            onChange={(e) =>
                                patchSubagent({ maxSteps: e.target.value ? Number(e.target.value) : undefined })
                            }
                            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                            placeholder="32"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        When to use
                    </label>
                    <textarea
                        value={subagent?.whenToUse ?? ""}
                        onChange={(e) => patchSubagent({ whenToUse: e.target.value })}
                        className="h-20 w-full resize-y rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-secondary"
                        placeholder="Shown to the calling agent so it knows when to pick this subagent."
                    />
                </div>
                <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs text-text-muted">
                        <input
                            type="checkbox"
                            checked={subagent?.selectable !== false}
                            onChange={(e) => patchSubagent({ selectable: e.target.checked })}
                        />
                        Selectable in conversations
                    </label>
                    <label className="flex items-center gap-2 text-xs text-text-muted">
                        <input
                            type="checkbox"
                            checked={Boolean(subagent?.allowExec)}
                            onChange={(e) => patchSubagent({ allowExec: e.target.checked || undefined })}
                        />
                        Allow execute_bash
                    </label>
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    State defaults (JSON)
                </label>
                <textarea
                    value={stateDefaultsRaw}
                    onChange={(e) => handleStateDefaultsChange(e.target.value)}
                    className="h-32 w-full resize-y rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs font-mono text-text-secondary"
                    placeholder='{"goal":"...","constraints":["..."]}'
                />
                {stateDefaultsError && <div className="text-xs text-status-error-text">{stateDefaultsError}</div>}
            </div>
        </>
    );

    const dependenciesPanel = (
        <Panel className="mb-3 space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-text-primary">Dependencies</div>
                <div className="text-xs text-text-muted">Edges are “upstream → this node”</div>
            </div>
            {!selectedNodeId ? (
                <div className="text-sm text-text-muted">Select a node to edit dependencies.</div>
            ) : (
                <div className="max-h-72 overflow-y-auto scrollbar-elegant rounded-md border border-border-subtle bg-bg-surface">
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
    );

    const notesPanel = (
        <Panel className="mt-1 p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Notes</div>
            <div className="mt-1 text-xs text-text-muted leading-relaxed">
                - Every node is a ReAct agent; graphs run as a DAG.\n
                - Delegation happens at runtime via the `task` tool, not via edges.\n
                - Give the graph a subagent key to make it callable by other agents.\n
                - LLM is chosen on Agent / automation / Configuration defaults — not on nodes.\n
                - Node output must be strict JSON.\n
                - `{"{{state}}"}` injects the current run state JSON.
            </div>
        </Panel>
    );

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
                        {saveError && <div className="mt-2 text-xs text-status-error-text">{saveError}</div>}
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
                                        ? "border-status-success-border bg-status-success-bg"
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
                                            <span className="rounded border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-status-success-text">
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

            <aside className="flex max-w-full min-w-[420px] w-[min(680px,48vw)] shrink-0 flex-col border-l border-border-subtle bg-bg-app min-h-0">
                <div className="shrink-0 border-b border-border-subtle px-4 py-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-text-muted">Inspector</div>
                    <div className="mt-0.5 text-[11px] text-text-muted">
                        {selectedNodeId
                            ? "Node details appear first; expand Graph settings when needed. LLM comes from Agent, automations, or Configuration — see the note on the node panel."
                            : "Select a node on the left to edit prompts, tools, and edges."}
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto scrollbar-elegant px-4 pb-4 pt-3">
                    {selectedNodeId ? (
                        <>
                            <NodeInspector
                                node={selectedNode}
                                onChange={handleUpdateSelectedNode}
                                onDelete={handleDeleteNode}
                                onResetPrompt={handleResetToDefault}
                            />
                            {dependenciesPanel}
                            <details className="group mb-3 rounded-lg border border-border-subtle bg-bg-surface">
                                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text-primary marker:content-none [&::-webkit-details-marker]:hidden hover:bg-state-hover rounded-lg">
                                    Graph settings
                                    <span className="ml-2 text-xs font-normal text-text-muted">(execution, state defaults)</span>
                                </summary>
                                <div className="space-y-3 border-t border-border-subtle p-4">{graphSettingsFields}</div>
                            </details>
                            {notesPanel}
                        </>
                    ) : (
                        <>
                            <Panel className="mb-3 space-y-3 p-4">
                                <div className="text-sm font-semibold text-text-primary">Graph settings</div>
                                {graphSettingsFields}
                            </Panel>
                            {dependenciesPanel}
                            <NodeInspector
                                node={selectedNode}
                                onChange={handleUpdateSelectedNode}
                                onDelete={handleDeleteNode}
                                onResetPrompt={handleResetToDefault}
                            />
                            {notesPanel}
                        </>
                    )}
                </div>
            </aside>
        </div>
    );
}
