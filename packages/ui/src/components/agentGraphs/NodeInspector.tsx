"use client";

import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";

import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { nodeOutputSchemaOptions } from "@kletron/shared/nodeOutputSchemas";

type ToolMeta = {
    name: string;
    label: string;
    description: string;
    categories: string[];
};

type SkillMeta = {
    slug: string;
    name: string;
    description: string;
    source: "builtin" | "user";
};

export type AgentNodeEditorValue = {
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
};

export function NodeInspector({
    node,
    onChange,
    onDelete,
    onResetPrompt,
}: {
    node: AgentNodeEditorValue | null;
    onChange: (next: AgentNodeEditorValue) => void;
    onDelete?: (nodeId: string) => void;
    onResetPrompt?: () => void;
}) {
    const [tools, setTools] = useState<ToolMeta[]>([]);
    const [toolSearch, setToolSearch] = useState("");
    const [skills, setSkills] = useState<SkillMeta[]>([]);
    const [skillSearch, setSkillSearch] = useState("");

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

    useEffect(() => {
        const loadSkills = async () => {
            try {
                const res = await fetch("/api/skills?source=builtin&limit=500");
                if (!res.ok) return;
                const data = await res.json();
                if (Array.isArray(data?.skills)) {
                    setSkills(data.skills);
                }
            } catch {
                // ignore
            }
        };
        void loadSkills();
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

    const filteredSkills = useMemo(() => {
        const q = skillSearch.trim().toLowerCase();
        if (!q) return skills;
        return skills.filter((skill) => {
            return (
                skill.slug.toLowerCase().includes(q) ||
                skill.name.toLowerCase().includes(q) ||
                (skill.description ?? "").toLowerCase().includes(q)
            );
        });
    }, [skills, skillSearch]);

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

    const toggleSkill = (slug: string) => {
        const current = new Set(node.react.skillIds ?? []);
        if (current.has(slug)) current.delete(slug);
        else current.add(slug);
        onChange({
            ...node,
            react: { ...node.react, skillIds: Array.from(current).sort() },
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

                <div
                    className="rounded-md border border-border-subtle bg-bg-elevated/60 px-3 py-2.5 text-[11px] leading-snug text-text-secondary"
                    role="note"
                >
                    <div className="flex gap-2">
                        <Info className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                        <p>
                            LLM is not set per node. Use the{" "}
                            <span className="font-medium text-text-primary">Agent</span> composer LLM for chat
                            threads, the LLM configured on each{" "}
                            <span className="font-medium text-text-primary">automation</span> stage when present,
                            or <span className="font-medium text-text-primary">Configuration → LLM</span> defaults
                            when you start a run with <span className="font-medium text-text-primary">Run</span> on
                            this graph.
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        Output schema
                    </label>
                    <select
                        value={node.output.schemaId}
                        onChange={(e) =>
                            onChange({ ...node, output: { ...node.output, schemaId: e.target.value } })
                        }
                        className="w-full rounded border-border-subtle bg-bg-surface px-2 py-2 text-sm"
                    >
                        {nodeOutputSchemaOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        State write path (optional)
                    </label>
                    <input
                        value={node.output.statePath ?? ""}
                        onChange={(e) =>
                            onChange({
                                ...node,
                                output: { ...node.output, statePath: e.target.value || undefined },
                            })
                        }
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                        placeholder="e.g. plan or quality.gates"
                    />
                    <label className="flex items-center gap-2 text-xs text-text-muted">
                        <input
                            type="checkbox"
                            checked={Boolean(node.output.stateMerge)}
                            onChange={(e) =>
                                onChange({
                                    ...node,
                                    output: { ...node.output, stateMerge: e.target.checked || undefined },
                                })
                            }
                        />
                        Merge objects at path
                    </label>
                </div>
            </Panel>

            <Panel className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-text-primary">System prompt</div>
                    {onResetPrompt && (
                        <Button variant="secondary" size="xs" onClick={onResetPrompt}>
                            Reset to default
                        </Button>
                    )}
                </div>
                <textarea
                    value={node.react.systemPrompt}
                    onChange={(e) => onChange({ ...node, react: { ...node.react, systemPrompt: e.target.value } })}
                    className="min-h-[220px] w-full resize-y rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm font-mono leading-relaxed text-text-secondary "
                    placeholder="System prompt for this ReAct node"
                    rows={12}
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
                    className="min-h-[200px] w-full resize-y rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm font-mono leading-relaxed text-text-secondary disabled:opacity-60"
                    placeholder={"Example:\nAnalyze this state:\n{{state}}\nReturn strict JSON."}
                    rows={10}
                />
            </Panel>

            <Panel className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-text-primary">Pinned skills</div>
                    <div className="text-xs text-text-muted">{node.react.skillIds?.length ?? 0} pinned</div>
                </div>
                <div className="text-xs text-text-muted">
                    Pinned skills are always injected by this graph. V1 only allows built-in/global skills here.
                </div>

                <input
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                    placeholder="Search built-in skills..."
                />

                <div className="max-h-[min(20rem,45vh)] overflow-y-auto scrollbar-elegant rounded-md border border-border-subtle bg-bg-surface">
                    <div className="divide-y divide-border-subtle">
                        {filteredSkills.map((skill) => {
                            const checked = (node.react.skillIds ?? []).includes(skill.slug);
                            return (
                                <label
                                    key={skill.slug}
                                    className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-state-hover"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSkill(skill.slug)}
                                    />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-text-primary">{skill.slug}</span>
                                            <span className="text-xs text-text-muted">{skill.name}</span>
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-text-muted line-clamp-2">
                                            {skill.description}
                                        </div>
                                    </div>
                                </label>
                            );
                        })}
                        {filteredSkills.length === 0 && (
                            <div className="p-3 text-sm text-text-muted">No built-in skills match this search.</div>
                        )}
                    </div>
                </div>
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

                <div className="max-h-[min(28rem,55vh)] overflow-y-auto scrollbar-elegant rounded-md border border-border-subtle bg-bg-surface">
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
