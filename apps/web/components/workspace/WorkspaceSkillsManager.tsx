"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { FolderOpen, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import {
    Button,
    Input,
    Modal,
    Panel,
    Skeleton,
    Switch,
    Textarea,
} from "@kletron/ui/components/design-system";
import {
    composeSkillMarkdown,
    skillCreateSchema,
    SLUG_REGEX,
    type SkillCreateInput,
    type SkillRecord,
    type WorkspaceSkillView,
} from "@kletron/shared";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import { useSkillsLibrary } from "../../hooks/useSkillsLibrary";
import { useWorkspaceSkills } from "../../hooks/useWorkspaceSkills";

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

export function WorkspaceSkillsManager({ workspaceId }: { workspaceId: string }) {
    const { workspaces } = useWorkspace();
    const pageWorkspace = useMemo(
        () => workspaces.find((w) => w.id === workspaceId) ?? null,
        [workspaces, workspaceId],
    );
    const [search, setSearch] = useState("");
    const {
        isLoading,
        error,
        refresh: refreshSkillsLibrary,
        createSkill,
        updateSkill,
        deleteSkill,
    } = useSkillsLibrary({ workspaceId });
    const {
        skills: workspaceSkills,
        setEnabled,
        setAutoLoadInNewThreads,
        isLoading: workspaceSkillsLoading,
        error: workspaceSkillsError,
        refresh: refreshWorkspaceSkills,
    } = useWorkspaceSkills(workspaceId);

    const [workspaceLinkBusy, setWorkspaceLinkBusy] = useState(false);
    const [workspaceLinkError, setWorkspaceLinkError] = useState<string | null>(null);

    const setSkillEnabledForWorkspace = useCallback(
        async (slug: string, enabled: boolean) => {
            setWorkspaceLinkBusy(true);
            setWorkspaceLinkError(null);
            try {
                await setEnabled(slug, enabled);
                await refreshSkillsLibrary();
            } catch (err) {
                setWorkspaceLinkError((err as Error).message);
            } finally {
                setWorkspaceLinkBusy(false);
            }
        },
        [refreshSkillsLibrary, setEnabled],
    );

    const setSkillAutoLoad = useCallback(
        async (slug: string, autoLoadInNewThreads: boolean) => {
            setWorkspaceLinkBusy(true);
            setWorkspaceLinkError(null);
            try {
                await setAutoLoadInNewThreads(slug, autoLoadInNewThreads);
                await refreshSkillsLibrary();
            } catch (err) {
                setWorkspaceLinkError((err as Error).message);
            } finally {
                setWorkspaceLinkBusy(false);
            }
        },
        [refreshSkillsLibrary, setAutoLoadInNewThreads],
    );

    const { activeForWorkspace, libraryOnlyForWorkspace } = useMemo(() => {
        const active: WorkspaceSkillView[] = [];
        const rest: WorkspaceSkillView[] = [];
        const q = search.trim().toLowerCase();
        const filtered = workspaceSkills.filter((skill) => {
            if (!q) return true;
            return (
                skill.name.toLowerCase().includes(q) ||
                skill.slug.toLowerCase().includes(q) ||
                skill.tags.some((tag) => tag.toLowerCase().includes(q))
            );
        });
        for (const s of filtered) {
            if (s.availableInWorkspace) active.push(s);
            else rest.push(s);
        }
        const byName = (a: WorkspaceSkillView, b: WorkspaceSkillView) => a.name.localeCompare(b.name);
        active.sort(byName);
        rest.sort(byName);
        return { activeForWorkspace: active, libraryOnlyForWorkspace: rest };
    }, [workspaceSkills, search]);
    const [editor, setEditor] = useState<EditorState>(blankEditor);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const workspaceSkillBySlug = useMemo(
        () => new Map(workspaceSkills.map((skill) => [skill.slug, skill])),
        [workspaceSkills],
    );

    const openCreate = () => {
        setSaveError(null);
        setWorkspaceLinkError(null);
        setEditor({ ...blankEditor, isOpen: true });
    };
    const openEdit = (skill: SkillRecord) => {
        setSaveError(null);
        setWorkspaceLinkError(null);
        setEditor(fromRecord(skill));
    };
    const closeEditor = () => {
        setWorkspaceLinkError(null);
        setEditor((prev) => ({ ...prev, isOpen: false }));
    };

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
            await Promise.all([refreshSkillsLibrary(), refreshWorkspaceSkills()]);
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
            await Promise.all([refreshSkillsLibrary(), refreshWorkspaceSkills()]);
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
                        <h1 className="text-lg font-semibold text-text-primary">Skills</h1>
                        <p className="text-sm text-text-muted">
                            Author SKILL.md files, enable skills for this workspace, and manage your
                            library in one place.
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-text-muted">
                    <Link
                        href="/app/config/connectors"
                        className="text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
                    >
                        Connectors
                    </Link>
                    <span>{workspaceSkillsLoading ? "Loading…" : `${workspaceSkills.length} skills`}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-elegant">
                {pageWorkspace?.rootPath ? (
                    <Panel className="border border-border-subtle bg-bg-elevated/80 p-4">
                        <div className="flex gap-3">
                            <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" />
                            <div className="space-y-1 text-sm">
                                <p className="font-medium text-text-primary">
                                    Saving into{" "}
                                    <span className="text-text-primary">{pageWorkspace.name}</span>
                                </p>
                                <p className="text-text-muted">
                                    &quot;New skill&quot; and edits write{" "}
                                    <code className="rounded bg-bg-surface px-1 py-0.5 text-xs">
                                        {".kletron/skills/<slug>/SKILL.md"}
                                    </code>{" "}
                                    under{" "}
                                    <code className="break-all rounded bg-bg-surface px-1 py-0.5 text-xs">
                                        {pageWorkspace.rootPath}
                                    </code>
                                    . Select this workspace in the shell when chatting so / commands
                                    and runs use these skills.
                                </p>
                            </div>
                        </div>
                    </Panel>
                ) : pageWorkspace && !pageWorkspace.rootPath ? (
                    <Panel className="border border-status-warning-border bg-status-warning-bg/30 p-4">
                        <p className="text-sm text-text-primary">
                            This workspace{" "}
                            <span className="font-medium">{pageWorkspace.name}</span> has no folder
                            path. Map a repository folder in{" "}
                            <Link href="/app/config/workspace" className="underline">
                                workspace settings
                            </Link>{" "}
                            — otherwise skills cannot be written to disk.
                        </p>
                    </Panel>
                ) : (
                    <Panel className="border border-status-warning-border bg-status-warning-bg/30 p-4">
                        <p className="text-sm text-text-primary">
                            This workspace is not in your list (it may have been removed).{" "}
                            <Link href="/app/config/workspace" className="underline">
                                Manage workspaces
                            </Link>
                            .
                        </p>
                    </Panel>
                )}

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

                {(error || workspaceSkillsError) && (
                    <p className="text-xs text-status-error-text">Error: {error ?? workspaceSkillsError}</p>
                )}

                {(isLoading || workspaceSkillsLoading) && (
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

                {!workspaceSkillsLoading && (
                    <p className="text-xs text-text-muted">
                        <span className="font-medium text-text-secondary">Available in this workspace</span> means the
                        agent can load or slash-call this skill here. Availability comes from an explicit workspace
                        activation and/or a repo-native file under{" "}
                        <code className="rounded bg-bg-elevated px-1 py-0.5 font-mono text-[10px]">
                            .kletron/skills/
                        </code>{" "}
                        . <span className="font-medium text-text-secondary">Auto-load</span> injects the skill at the
                        start of each new thread. <span className="font-medium text-text-secondary">Pinned</span> means
                        the current graph injects it independently of the thread.
                    </p>
                )}

                {!workspaceSkillsLoading ? (
                    <>
                        <section className="space-y-3">
                            <h2 className="text-sm font-semibold text-text-primary">
                                Available in this workspace ({activeForWorkspace.length})
                            </h2>
                            <p className="text-xs text-text-muted">
                                These skills are available to the agent here. Some may be repo-native, some explicitly
                                activated, and some may also auto-load at the start of new threads.
                            </p>
                            {activeForWorkspace.length === 0 ? (
                                <p className="text-xs text-text-muted">
                                    None match your search. Create a skill or add{" "}
                                    <code className="rounded bg-bg-elevated px-1 py-0.5 font-mono text-[10px]">
                                        {".kletron/skills/<slug>/SKILL.md"}
                                    </code>{" "}
                                    in the repo.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {activeForWorkspace.map((skill) => (
                                        <SkillPanel
                                            key={skill.slug}
                                            skill={skill}
                                            readOnly={skill.source === "builtin"}
                                            onDisableForWorkspace={
                                                skill.repoNativePresent
                                                    ? undefined
                                                    : () => {
                                                          if (
                                                              !confirm(
                                                                  `Stop explicitly enabling "${skill.slug}" for this workspace?`,
                                                              )
                                                          ) {
                                                              return;
                                                          }
                                                          void setSkillEnabledForWorkspace(skill.slug, false);
                                                      }
                                            }
                                            onAutoLoadChange={(next) => void setSkillAutoLoad(skill.slug, next)}
                                            enableForWorkspaceBusy={workspaceLinkBusy}
                                            onEdit={openEdit}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-sm font-semibold text-text-primary">
                                In library only — not active here ({libraryOnlyForWorkspace.length})
                            </h2>
                            <p className="text-xs text-text-muted">
                                Use <span className="font-medium text-text-secondary">Add to workspace</span>{" "}
                                to make a library skill available here. Repo files under{" "}
                                <code className="rounded bg-bg-elevated px-1 py-0.5 font-mono text-[10px]">
                                    .kletron/skills/
                                </code>{" "}
                                are picked up automatically.
                            </p>
                            {libraryOnlyForWorkspace.length === 0 ? (
                                <p className="text-xs text-text-muted">
                                    Everything in your search is active for this workspace.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {libraryOnlyForWorkspace.map((skill) => (
                                        <SkillPanel
                                            key={skill.slug}
                                            skill={skill}
                                            readOnly={skill.source === "builtin"}
                                            onEnableForWorkspace={() =>
                                                void setSkillEnabledForWorkspace(skill.slug, true)
                                            }
                                            onAutoLoadChange={(next) => void setSkillAutoLoad(skill.slug, next)}
                                            enableForWorkspaceBusy={workspaceLinkBusy}
                                            onEdit={openEdit}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                ) : null}
            </div>

            <Modal
                open={editor.isOpen}
                onClose={closeEditor}
                title={editorTitle}
                subtitle={editorSubtitle}
                footer={
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-h-[32px] flex-wrap items-center gap-2">
                            {editor.mode === "edit" && editor.slug ? (
                                <>
                                    {(() => {
                                        const skillState = workspaceSkillBySlug.get(editor.slug);
                                        if (!skillState) return null;
                                        if (!skillState.availableInWorkspace) {
                                            return (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            disabled={workspaceLinkBusy || isSaving}
                                            onClick={() =>
                                                void setSkillEnabledForWorkspace(editor.slug, true)
                                            }
                                        >
                                            {workspaceLinkBusy ? "Updating…" : "Add to this workspace"}
                                        </Button>
                                            );
                                        }
                                        if (skillState.repoNativePresent) {
                                            return (
                                                <span className="max-w-[min(100%,28rem)] text-[11px] text-text-muted">
                                                    Availability is controlled by the repo file under{" "}
                                                    <code className="rounded bg-bg-surface px-1 py-0.5 text-[10px]">
                                                        .kletron/skills/{editor.slug}/SKILL.md
                                                    </code>
                                                    .
                                                </span>
                                            );
                                        }
                                        return (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            disabled={workspaceLinkBusy || isSaving}
                                            onClick={() => {
                                                if (
                                                    !confirm(
                                                        `Stop using "${editor.slug}" for this workspace? If this skill still exists under .kletron/skills/ on disk, it can stay active until you remove that file.`,
                                                    )
                                                ) {
                                                    return;
                                                }
                                                void setSkillEnabledForWorkspace(editor.slug, false);
                                            }}
                                        >
                                            {workspaceLinkBusy ? "Updating…" : "Remove from workspace"}
                                        </Button>
                                        );
                                    })()}
                                </>
                            ) : editor.mode === "create" && pageWorkspace?.rootPath ? (
                                <span className="text-[11px] text-text-muted">
                                    After you save, this skill is written into the repo and becomes active
                                    here.
                                </span>
                            ) : editor.mode === "create" && pageWorkspace && !pageWorkspace.rootPath ? (
                                <span className="text-[11px] text-status-warning-text">
                                    Map a folder for this workspace first — otherwise save only updates the
                                    cloud library.
                                </span>
                            ) : editor.mode === "create" && !pageWorkspace ? (
                                <span className="text-[11px] text-text-muted">
                                    Workspace unavailable — saves update the cloud library only.
                                </span>
                            ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                            <Button variant="secondary" onClick={closeEditor} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button variant="secondary" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? "Saving…" : "Save"}
                            </Button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-4">
                    {saveError && (
                        <Panel className="border-status-error-border bg-status-error-bg/30 p-3">
                            <p className="text-xs text-status-error-text">{saveError}</p>
                        </Panel>
                    )}
                    {workspaceLinkError && (
                        <Panel className="border-status-error-border bg-status-error-bg/30 p-3">
                            <p className="text-xs text-status-error-text">{workspaceLinkError}</p>
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
    onEnableForWorkspace,
    onDisableForWorkspace,
    onAutoLoadChange,
    enableForWorkspaceBusy,
}: {
    skill: WorkspaceSkillView;
    onEdit: (skill: SkillRecord) => void;
    onDelete: (skill: SkillRecord) => void;
    readOnly?: boolean;
    onEnableForWorkspace?: () => void;
    onDisableForWorkspace?: () => void;
    onAutoLoadChange?: (next: boolean) => void;
    enableForWorkspaceBusy?: boolean;
}) {
    return (
        <Panel className="p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Sparkles className="h-4 w-4 shrink-0 text-text-muted" />
                        <h3 className="truncate text-sm font-semibold text-text-primary">
                            {skill.name}
                        </h3>
                        <span className="shrink-0 rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted">
                            {skill.slug}
                        </span>
                        {skill.availableInWorkspace ? (
                            <span className="shrink-0 rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-medium text-status-success-text">
                                Available in workspace
                            </span>
                        ) : null}
                        {!skill.availableInWorkspace ? (
                            <span className="shrink-0 rounded-md border border-border-subtle bg-bg-app px-2 py-0.5 text-[10px] text-text-muted">
                                Library only
                            </span>
                        ) : null}
                        {skill.repoNativePresent ? (
                            <span className="shrink-0 rounded-md border border-border-subtle bg-bg-app px-2 py-0.5 text-[10px] text-text-muted">
                                Repo-native
                            </span>
                        ) : null}
                    </div>
                    {skill.description ? (
                        <p className="mt-1 text-xs text-text-secondary">{skill.description}</p>
                    ) : null}
                    <div className="mt-2 text-[11px] text-text-muted">
                        {skill.availableInWorkspace
                            ? `Availability source: ${skill.availabilitySource}.`
                            : "Not available in this workspace yet."}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <Switch
                            checked={skill.autoLoadInNewThreads}
                            onChange={(checked) => onAutoLoadChange?.(checked)}
                            disabled={enableForWorkspaceBusy || !skill.availableInWorkspace}
                        />
                        <span className="text-[11px] text-text-muted">
                            Auto-load in new threads
                        </span>
                    </div>
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
                    {!skill.availableInWorkspace && onEnableForWorkspace ? (
                        <Button
                            size="sm"
                            variant="primary"
                            disabled={enableForWorkspaceBusy}
                            onClick={onEnableForWorkspace}
                        >
                            Add to workspace
                        </Button>
                    ) : null}
                    {skill.availableInWorkspace && onDisableForWorkspace ? (
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={enableForWorkspaceBusy}
                            onClick={onDisableForWorkspace}
                        >
                            Remove
                        </Button>
                    ) : null}
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
