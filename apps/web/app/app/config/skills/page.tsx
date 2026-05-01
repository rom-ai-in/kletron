"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@kletron/ui/components/ui/Card";
import { Button } from "@kletron/ui/components/ui/Button";
import { Input } from "@kletron/ui/components/ui/Input";
import { Modal as Dialog } from "@kletron/ui/components/ui/Modal";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import {
    composeSkillMarkdown,
    skillCreateSchema,
    SLUG_REGEX,
    type SkillCreateInput,
    type SkillRecord,
} from "@kletron/shared";
import { useSkillsLibrary } from "../../../../hooks/useSkillsLibrary";

const EMPTY_BODY = `## When to use this skill

Describe when the agent should rely on this skill.

## Instructions

Step-by-step guidance for the agent.
`;

interface EditorState {
    isOpen: boolean;
    mode: "create" | "edit";
    slug: string;
    name: string;
    version: string;
    description: string;
    tags: string;
    requiredTools: string;
    suggestedTools: string;
    body: string;
}

const blankEditor: EditorState = {
    isOpen: false,
    mode: "create",
    slug: "",
    name: "",
    version: "1.0.0",
    description: "",
    tags: "",
    requiredTools: "",
    suggestedTools: "",
    body: EMPTY_BODY,
};

function fromRecord(skill: SkillRecord): EditorState {
    return {
        isOpen: true,
        mode: "edit",
        slug: skill.slug,
        name: skill.name,
        version: skill.version,
        description: skill.description,
        tags: skill.tags.join(", "),
        requiredTools: skill.requiredTools.join(", "),
        suggestedTools: skill.suggestedTools.join(", "),
        body: skill.body,
    };
}

function toCreateInput(state: EditorState): SkillCreateInput {
    const splitCsv = (s: string) =>
        s
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
    return skillCreateSchema.parse({
        slug: state.slug,
        frontmatter: {
            name: state.name,
            version: state.version || undefined,
            description: state.description || undefined,
            tags: splitCsv(state.tags),
            requiredTools: splitCsv(state.requiredTools),
            suggestedTools: splitCsv(state.suggestedTools),
        },
        body: state.body,
    });
}

export default function SkillsLibraryPage() {
    const [search, setSearch] = useState("");
    const { skills, isLoading, error, createSkill, updateSkill, deleteSkill } =
        useSkillsLibrary({ search });
    const [editor, setEditor] = useState<EditorState>(blankEditor);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const grouped = useMemo(() => {
        const builtin = skills.filter((s) => s.source === "builtin");
        const user = skills.filter((s) => s.source === "user");
        return { builtin, user };
    }, [skills]);

    const openCreate = () => {
        setSaveError(null);
        setEditor({ ...blankEditor, isOpen: true });
    };
    const openEdit = (skill: SkillRecord) => {
        setSaveError(null);
        setEditor(fromRecord(skill));
    };
    const closeEditor = () => setEditor((prev) => ({ ...prev, isOpen: false }));

    const handleSave = async () => {
        setSaveError(null);
        setIsSaving(true);
        try {
            const input = toCreateInput(editor);
            if (editor.mode === "create") {
                if (!SLUG_REGEX.test(input.slug)) {
                    throw new Error("slug must be lowercase kebab-case (a-z0-9-)");
                }
                await createSkill(input);
            } else {
                await updateSkill(editor.slug, {
                    frontmatter: input.frontmatter,
                    body: input.body,
                });
            }
            closeEditor();
        } catch (err) {
            setSaveError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (skill: SkillRecord) => {
        if (skill.source === "builtin") return;
        if (!confirm(`Delete skill "${skill.name}"?`)) return;
        try {
            await deleteSkill(skill.slug);
        } catch (err) {
            alert((err as Error).message);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">Skills Library</h1>
                    <p className="text-text-muted mt-1">
                        Reusable agent skills (SKILL.md). Activate them per workspace from the
                        workspace skills page.
                    </p>
                </div>
                <Button onClick={openCreate} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New skill
                </Button>
            </div>

            <div className="mb-6">
                <Input
                    leftIcon={Search}
                    placeholder="Search skills"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    fullWidth
                />
            </div>

            {error && (
                <p className="mb-4 text-sm text-status-error-text">Error: {error}</p>
            )}
            {isLoading ? (
                <p className="text-text-muted">Loading skills...</p>
            ) : (
                <div className="space-y-8">
                    <SkillSection
                        title="Built-in"
                        skills={grouped.builtin}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        readOnly
                    />
                    <SkillSection
                        title="Your skills"
                        skills={grouped.user}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                    />
                </div>
            )}

            <Dialog open={editor.isOpen} onClose={closeEditor} title="" subtitle="">
                <div className="space-y-4 p-6">
                    <h3 className="text-lg font-semibold text-text-primary">
                        {editor.mode === "create" ? "Create new skill" : `Edit ${editor.slug}`}
                    </h3>
                    {saveError && (
                        <div className="rounded-md border border-status-error-border bg-status-error-bg/40 p-3 text-sm text-status-error-text">
                            {saveError}
                        </div>
                    )}
                    {editor.mode === "create" && (
                        <Field label="Slug">
                            <Input
                                value={editor.slug}
                                onChange={(e) =>
                                    setEditor({ ...editor, slug: e.target.value.toLowerCase() })
                                }
                                placeholder="my-skill"
                                fullWidth
                            />
                        </Field>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Name">
                            <Input
                                value={editor.name}
                                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                                fullWidth
                            />
                        </Field>
                        <Field label="Version">
                            <Input
                                value={editor.version}
                                onChange={(e) => setEditor({ ...editor, version: e.target.value })}
                                placeholder="1.0.0"
                                fullWidth
                            />
                        </Field>
                    </div>
                    <Field label="Description">
                        <Input
                            value={editor.description}
                            onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                            fullWidth
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Tags (comma-separated)">
                            <Input
                                value={editor.tags}
                                onChange={(e) => setEditor({ ...editor, tags: e.target.value })}
                                placeholder="research, drafting"
                                fullWidth
                            />
                        </Field>
                        <Field label="Required tools">
                            <Input
                                value={editor.requiredTools}
                                onChange={(e) =>
                                    setEditor({ ...editor, requiredTools: e.target.value })
                                }
                                placeholder="github_api, fetch_url"
                                fullWidth
                            />
                        </Field>
                    </div>
                    <Field label="Suggested tools">
                        <Input
                            value={editor.suggestedTools}
                            onChange={(e) =>
                                setEditor({ ...editor, suggestedTools: e.target.value })
                            }
                            placeholder="web_search"
                            fullWidth
                        />
                    </Field>
                    <Field label="Body (markdown)">
                        <textarea
                            className="w-full h-72 p-3 border border-border-subtle rounded-md bg-bg-surface text-text-primary font-mono text-sm focus:outline-none focus:border-border-strong"
                            value={editor.body}
                            onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                        />
                    </Field>
                    <details className="text-xs text-text-muted">
                        <summary className="cursor-pointer">Preview SKILL.md</summary>
                        <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-bg-elevated p-3 text-text-primary">
                            {composeSkillMarkdown({
                                name: editor.name,
                                version: editor.version,
                                description: editor.description,
                                tags: editor.tags
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                requiredTools: editor.requiredTools
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                suggestedTools: editor.suggestedTools
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                extends: [],
                                body: editor.body,
                            })}
                        </pre>
                    </details>
                </div>
                <div className="flex justify-end gap-2 border-t border-border-subtle px-6 py-4">
                    <Button variant="secondary" onClick={closeEditor} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save skill"}
                    </Button>
                </div>
            </Dialog>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block text-xs font-medium text-text-secondary">
            <span className="mb-1 block">{label}</span>
            {children}
        </label>
    );
}

function SkillSection({
    title,
    skills,
    onEdit,
    onDelete,
    readOnly,
}: {
    title: string;
    skills: SkillRecord[];
    onEdit: (skill: SkillRecord) => void;
    onDelete: (skill: SkillRecord) => void;
    readOnly?: boolean;
}) {
    return (
        <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                {title} <span className="text-text-muted">({skills.length})</span>
            </h2>
            {skills.length === 0 ? (
                <p className="text-sm text-text-muted italic">None</p>
            ) : (
                <div className="space-y-3">
                    {skills.map((skill) => (
                        <Card key={skill.slug} className="border-border-subtle bg-bg-surface">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-text-primary">
                                                {skill.name}
                                            </span>
                                            <span className="rounded bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted">
                                                {skill.slug}
                                            </span>
                                            <span className="rounded bg-bg-elevated px-2 py-0.5 text-[10px] text-text-muted">
                                                v{skill.version}
                                            </span>
                                        </div>
                                        {skill.description && (
                                            <p className="mt-1 text-xs text-text-muted">
                                                {skill.description}
                                            </p>
                                        )}
                                        {skill.tags.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {skill.tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] text-text-muted"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => onEdit(skill)}
                                            title={readOnly ? "View" : "Edit"}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        {!readOnly && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                onClick={() => onDelete(skill)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </section>
    );
}
