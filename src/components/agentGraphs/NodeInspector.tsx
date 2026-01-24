"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { nodeOutputSchemaOptions } from "../../shared/nodeOutputSchemas";

type ToolMeta = {
    name: string;
    label: string;
    description: string;
    categories: string[];
};

export type AgentNodeEditorValue = {
    id: string;
    label: string;
    react: {
        systemPrompt: string;
        userPromptTemplate: string;
        toolNames: string[];
        llmSelection?: { provider: "azure" | "lmstudio"; model?: string };
    };
    output: { schemaId: string };
};

export function NodeInspector({
    node,
    onChange,
    onDelete,
}: {
    node: AgentNodeEditorValue | null;
    onChange: (next: AgentNodeEditorValue) => void;
    onDelete?: (nodeId: string) => void;
}) {
    const [tools, setTools] = useState<ToolMeta[]>([]);
    const [toolSearch, setToolSearch] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/tools/list");
                if (!res.ok) return;
                const data = await res.json();
                if (Array.isArray(data)) setTools(data);
            } catch {
                // ignore
            }
        };
        void load();
    }, []);

    const filteredTools = useMemo(() => {
        const q = toolSearch.trim().toLowerCase();
        if (!q) return tools;
        return tools.filter((t) => {
            return (
                t.name.toLowerCase().includes(q) ||
                t.label.toLowerCase().includes(q) ||
                (t.description ?? "").toLowerCase().includes(q) ||
                (t.categories ?? []).some((c) => c.toLowerCase().includes(q))
            );
        });
    }, [tools, toolSearch]);

    if (!node) {
        return (
            <Panel className="p-4">
                <div className="text-sm text-text-muted">Select a node to edit its prompt and tools.</div>
            </Panel>
        );
    }

    const toggleTool = (name: string) => {
        const current = new Set(node.react.toolNames ?? []);
        if (current.has(name)) current.delete(name);
        else current.add(name);
        onChange({
            ...node,
            react: { ...node.react, toolNames: Array.from(current).sort() },
        });
    };

    return (
        <div className="space-y-3">
            <Panel className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-text-primary">Node</div>
                    {onDelete && (
                        <Button variant="danger" size="xs" onClick={() => onDelete(node.id)}>
                            Delete
                        </Button>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        Label
                    </label>
                    <input
                        value={node.label}
                        onChange={(e) => onChange({ ...node, label: e.target.value })}
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                        placeholder="Node label"
                    />
                    <div className="text-[10px] font-mono text-text-muted">id: {node.id}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                            Provider
                        </label>
                        <select
                            value={node.react.llmSelection?.provider ?? "azure"}
                            onChange={(e) =>
                                onChange({
                                    ...node,
                                    react: {
                                        ...node.react,
                                        llmSelection: {
                                            provider: e.target.value as "azure" | "lmstudio",
                                            model: node.react.llmSelection?.model,
                                        },
                                    },
                                })
                            }
                            className="w-full rounded border-border-subtle bg-bg-surface px-2 py-2 text-sm"
                        >
                            <option value="azure">Azure OpenAI</option>
                            <option value="lmstudio">LM Studio</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                            Model (optional)
                        </label>
                        <input
                            value={node.react.llmSelection?.model ?? ""}
                            onChange={(e) =>
                                onChange({
                                    ...node,
                                    react: {
                                        ...node.react,
                                        llmSelection: {
                                            provider: node.react.llmSelection?.provider ?? "azure",
                                            model: e.target.value || undefined,
                                        },
                                    },
                                })
                            }
                            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                            placeholder="e.g. gpt-4o-mini"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        Output schema
                    </label>
                    <select
                        value={node.output.schemaId}
                        onChange={(e) => onChange({ ...node, output: { schemaId: e.target.value } })}
                        className="w-full rounded border-border-subtle bg-bg-surface px-2 py-2 text-sm"
                    >
                        {nodeOutputSchemaOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </Panel>

            <Panel className="space-y-2 p-4">
                <div className="text-sm font-semibold text-text-primary">System prompt</div>
                <textarea
                    value={node.react.systemPrompt}
                    onChange={(e) => onChange({ ...node, react: { ...node.react, systemPrompt: e.target.value } })}
                    className="h-40 w-full resize-none rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs font-mono text-text-secondary"
                    placeholder="System prompt for this ReAct node"
                />
            </Panel>

            <Panel className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-text-primary">User prompt template</div>
                    <div className="text-[10px] text-text-muted">Use `{"{{state}}"}` to inject current state JSON.</div>
                </div>
                <textarea
                    value={node.react.userPromptTemplate}
                    onChange={(e) =>
                        onChange({ ...node, react: { ...node.react, userPromptTemplate: e.target.value } })
                    }
                    className="h-40 w-full resize-none rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs font-mono text-text-secondary"
                    placeholder={"Example:\nAnalyze this state:\n{{state}}\nReturn strict JSON."}
                />
            </Panel>

            <Panel className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-text-primary">Tools</div>
                    <div className="text-xs text-text-muted">{node.react.toolNames?.length ?? 0} enabled</div>
                </div>

                <input
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                    placeholder="Search tools..."
                />

                <div className="max-h-80 overflow-y-auto scrollbar-elegant rounded-md border border-border-subtle bg-bg-surface">
                    <div className="divide-y divide-border-subtle">
                        {filteredTools.map((tool) => {
                            const checked = (node.react.toolNames ?? []).includes(tool.name);
                            return (
                                <label
                                    key={tool.name}
                                    className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-state-hover"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleTool(tool.name)}
                                        className="mt-1"
                                    />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-text-primary">{tool.name}</span>
                                            <span className="text-xs text-text-muted">{tool.label}</span>
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-text-muted line-clamp-2">
                                            {tool.description}
                                        </div>
                                    </div>
                                </label>
                            );
                        })}
                        {filteredTools.length === 0 && (
                            <div className="p-3 text-sm text-text-muted">No tools match this search.</div>
                        )}
                    </div>
                </div>
            </Panel>
        </div>
    );
}

