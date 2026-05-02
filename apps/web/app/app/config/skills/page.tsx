"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Sparkles, Trash2 } from "lucide-react";
import {
    Button,
    Input,
    Modal,
    Panel,
    Skeleton,
    Textarea,
} from "@kletron/ui/components/design-system";
import {
    composeSkillMarkdown,
    skillCreateSchema,
    SLUG_REGEX,
    type SkillCreateInput,
    type SkillRecord,
} from "@kletron/shared";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
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
    const { activeWorkspaceId } = useWorkspace();
    const [search, setSearch] = useState("");
    const { skills, isLoading, error, createSkill, updateSkill, deleteSkill } =
        useSkillsLibrary({ search, workspaceId: activeWorkspaceId });
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

    const editorTitle =
        editor.mode === "create" ? "Skill (new)" : `Skill: ${editor.slug}`;
    const editorSubtitle =
        editor.mode === "create" ? "Create SKILL.md" : editor.name || editor.slug;

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">
                            Skills library
                        </h1>
                        <p className="text-sm text-text-muted">
                            Reusable agent skills (SKILL.md); enable per workspace from workspace
                            settings.
                            {activeWorkspaceId ? (
                                <>
                                    {" "}
                                    With a workspace selected, the repo is the source of truth:
                                    skills live at{" "}
                                    <code className="rounded bg-bg-elevated px-1 py-0.5 text-xs">
                                        {".kletron/skills/<slug>/SKILL.md"}
                                    </code>{" "}
                                    and override matching entries in the library.
                                </>
                            ) : null}
                        </p>
                    </div>
                </div>
                <div className="text-xs text-text-muted">
                    {isLoading ? "Loading…" : `${skills.length} skills`}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-elegant">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Input
                        leftIcon={Search}
                        placeholder="Search by name, slug, or tag…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        fullWidth
                        size="sm"
                        containerClassName="lg:max-w-md"
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={openCreate}
                        className="inline-flex shrink-0 items-center gap-2 self-start lg:self-auto"
                    >
                        <Plus className="h-4 w-4" />
                        New skill
                    </Button>
                </div>

                {error && (
                    <p className="text-xs text-status-error-text">Error: {error}</p>
                )}

                {isLoading && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {[1, 2, 3, 4].map((i) => (
                            <Panel key={i} className="p-4">
                                <div className="space-y-3">
                                    <Skeleton className="h-5 w-52" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-6 w-24" />
                                        <Skeleton className="h-6 w-24" />
                                    </div>
                                </div>
                            </Panel>
                        ))}
                    </div>
                )}

                {!isLoading && (
                    <>
                        <section className="space-y-3">
                            <h2 className="text-sm font-semibold text-text-primary">Built-in</h2>
                            {grouped.builtin.length === 0 ? (
                                <p className="text-xs text-text-muted">
                                    No built-in skills match your search.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {grouped.builtin.map((skill) => (
                                        <SkillPanel
                                            key={skill.slug}
                                            skill={skill}
                                            readOnly
                                            onEdit={openEdit}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-sm font-semibold text-text-primary">Your skills</h2>
                            {grouped.user.length === 0 ? (
                                <p className="text-xs text-text-muted">
                                    No custom skills yet. Create one with &quot;New skill&quot;.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {grouped.user.map((skill) => (
                                        <SkillPanel
                                            key={skill.slug}
                                            skill={skill}
                                            onEdit={openEdit}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            <Modal
                open={editor.isOpen}
                onClose={closeEditor}
                title={editorTitle}
                subtitle={editorSubtitle}
                footer={
                    <div className="flex w-full items-center justify-end gap-2">
                        <Button variant="secondary" onClick={closeEditor} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button variant="secondary" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving…" : "Save"}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {saveError && (
                        <Panel className="border-status-error-border bg-status-error-bg/30 p-3">
                            <p className="text-xs text-status-error-text">{saveError}</p>
                        </Panel>
                    )}
                    {editor.mode === "create" && (
                        <Field label="Slug">
                            <Input
                                value={editor.slug}
                                onChange={(e) =>
                                    setEditor({
                                        ...editor,
                                        slug: e.target.value.toLowerCase(),
                                    })
                                }
                                placeholder="my-skill"
                                fullWidth
                                size="sm"
                                className="font-mono"
                            />
                        </Field>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Name">
                            <Input
                                value={editor.name}
                                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                                fullWidth
                                size="sm"
                            />
                        </Field>
                        <Field label="Version">
                            <Input
                                value={editor.version}
                                onChange={(e) =>
                                    setEditor({ ...editor, version: e.target.value })
                                }
                                placeholder="1.0.0"
                                fullWidth
                                size="sm"
                                className="font-mono"
                            />
                        </Field>
                    </div>
                    <Field label="Description">
                        <Input
                            value={editor.description}
                            onChange={(e) =>
                                setEditor({ ...editor, description: e.target.value })
                            }
                            fullWidth
                            size="sm"
                        />
                    </Field>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Tags (comma-separated)">
                            <Input
                                value={editor.tags}
                                onChange={(e) => setEditor({ ...editor, tags: e.target.value })}
                                placeholder="research, drafting"
                                fullWidth
                                size="sm"
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
                                size="sm"
                                className="font-mono text-xs"
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
                            size="sm"
                            className="font-mono text-xs"
                        />
                    </Field>
                    <Field label="Body (markdown)">
                        <Textarea
                            size="sm"
                            value={editor.body}
                            onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                            spellCheck={false}
                            className="min-h-[220px] font-mono"
                        />
                    </Field>
                    <details className="text-xs text-text-muted">
                        <summary className="cursor-pointer text-text-secondary hover:text-text-primary">
                            Preview composed SKILL.md
                        </summary>
                        <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-border-subtle bg-bg-app p-3 font-mono text-[11px] text-text-muted scrollbar-elegant">
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
            </Modal>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                {label}
            </span>
            {children}
        </label>
    );
}

function SkillPanel({
    skill,
    onEdit,
    onDelete,
    readOnly,
}: {
    skill: SkillRecord;
    onEdit: (skill: SkillRecord) => void;
    onDelete: (skill: SkillRecord) => void;
    readOnly?: boolean;
}) {
    return (
        <Panel className="p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 shrink-0 text-text-muted" />
                        <h3 className="truncate text-sm font-semibold text-text-primary">
                            {skill.name}
                        </h3>
                        <span className="shrink-0 rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted">
                            {skill.slug}
                        </span>
                    </div>
                    {skill.description ? (
                        <p className="mt-1 text-xs text-text-secondary">{skill.description}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                        <span className="rounded-md border border-border-subtle bg-bg-elevated/50 px-2 py-1">
                            v{skill.version}
                        </span>
                        {readOnly ? (
                            <span className="rounded-md border border-border-subtle bg-bg-elevated/50 px-2 py-1">
                                built-in
                            </span>
                        ) : null}
                        {skill.tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-md border border-border-subtle bg-bg-elevated/50 px-2 py-1"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
                    <Button size="sm" variant="secondary" onClick={() => onEdit(skill)}>
                        {readOnly ? "View" : "Edit"}
                    </Button>
                    {!readOnly && (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onDelete(skill)}
                            className="gap-1 text-status-error-text hover:text-status-error-text"
                            title="Delete"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                        </Button>
                    )}
                </div>
            </div>
        </Panel>
    );
}
