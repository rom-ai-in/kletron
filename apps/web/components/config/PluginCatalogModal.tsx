"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    buttonVariants,
    ConfigExplorerModal,
    ConfigExplorerMonoBlock,
    ConfigExplorerRow,
    ConfigExplorerSection,
    Panel,
} from "@kletron/ui/components/design-system";
import { ExternalLink, ListTree, ScrollText, Search, Wrench } from "lucide-react";
import type { PluginDefinition, SkillRecord } from "@kletron/shared";
import { Card, CardContent } from "@kletron/ui/components/ui/Card";
import { Input } from "@kletron/ui/components/ui/Input";
import { useConnectorCatalog } from "../../hooks/useConnectors";

type Tab = "overview" | "connectors";

type SkillDialogState =
    | { open: false }
    | {
          open: true;
          slug: string;
          skill: SkillRecord | null;
          loading: boolean;
          error: string | null;
      };

export interface PluginCatalogModalProps {
    plugin: PluginDefinition | null;
    open: boolean;
    onClose: () => void;
    /** Install/remove for the active workspace (same API as workspace plugins page). */
    workspacePluginActions?: {
        workspaceId: string;
        installed: boolean;
        busy: boolean;
        onInstall: () => void;
        onRemove: () => void;
    } | null;
}

function PluginConnectorsPanel({ plugin }: { plugin: PluginDefinition }) {
    const [search, setSearch] = useState("");
    const { types, isLoading, error } = useConnectorCatalog();

    const pluginTypes = useMemo(() => {
        const allow = new Set(plugin.connectorIds);
        return types.filter((t) => allow.has(t.id));
    }, [types, plugin.connectorIds]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return pluginTypes;
        return pluginTypes.filter(
            (t) =>
                t.id.includes(q) ||
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.category.includes(q)
        );
    }, [pluginTypes, search]);

    const grouped = useMemo(() => {
        const map = new Map<string, typeof filtered>();
        for (const def of filtered) {
            const arr = map.get(def.category) ?? [];
            arr.push(def);
            map.set(def.category, arr);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filtered]);

    return (
        <div className="space-y-4">
            <p className="text-xs text-text-muted">
                External services referenced by this plugin. Add them from each workspace&apos;s{" "}
                <span className="font-mono text-text-secondary">Connectors</span> page after you install the plugin.
            </p>
            <Input
                leftIcon={Search}
                placeholder="Search this plugin's connectors"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
            />
            {error && <p className="text-sm text-status-error-text">Error: {error}</p>}
            {isLoading ? (
                <p className="text-text-muted">Loading catalog...</p>
            ) : (
                <div className="space-y-8">
                    {grouped.map(([category, items]) => (
                        <section key={category}>
                            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                {category}
                            </h2>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {items.map((def) => (
                                    <Card key={def.id} className="border-border-subtle bg-bg-surface">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-text-primary">{def.name}</h3>
                                                    <p className="text-[11px] text-text-muted">
                                                        {def.id} · {def.auth}
                                                    </p>
                                                </div>
                                                {def.docsUrl && (
                                                    <a
                                                        href={def.docsUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-text-muted hover:text-text-primary"
                                                        title="Documentation"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                )}
                                            </div>
                                            <p className="mt-2 text-xs text-text-secondary">{def.description}</p>
                                            <div className="mt-3 flex flex-wrap gap-1">
                                                {def.unlocksTools.slice(0, 4).map((t) => (
                                                    <span
                                                        key={t}
                                                        className="rounded bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted"
                                                    >
                                                        {t}
                                                    </span>
                                                ))}
                                                {def.unlocksTools.length > 4 && (
                                                    <span className="text-[10px] text-text-muted">
                                                        +{def.unlocksTools.length - 4} more
                                                    </span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}

export function PluginCatalogModal({
    plugin,
    open,
    onClose,
    workspacePluginActions = null,
}: PluginCatalogModalProps) {
    const [tab, setTab] = useState<Tab>("overview");
    const [skillDialog, setSkillDialog] = useState<SkillDialogState>({ open: false });

    useEffect(() => {
        setTab("overview");
    }, [plugin?.id]);

    const closeSkillDialog = useCallback(() => {
        setSkillDialog({ open: false });
    }, []);

    const openSkillDialog = useCallback(async (slug: string) => {
        setSkillDialog({ open: true, slug, skill: null, loading: true, error: null });
        try {
            const res = await fetch(`/api/skills/${encodeURIComponent(slug)}`);
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Failed to load skill (${res.status})`);
            }
            const json = (await res.json()) as { skill: SkillRecord };
            setSkillDialog({ open: true, slug, skill: json.skill, loading: false, error: null });
        } catch (err) {
            setSkillDialog({
                open: true,
                slug,
                skill: null,
                loading: false,
                error: (err as Error).message,
            });
        }
    }, []);

    const sd = skillDialog.open ? skillDialog : null;
    const skillFooterSummary =
        sd && !sd.loading && sd.skill
            ? `${sd.skill.source} • v${sd.skill.version}`
            : sd?.loading
              ? "Loading…"
              : "";

    const tabBtn = (id: Tab, label: string) => (
        <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === id
                    ? "border-text-primary bg-state-selected text-text-primary"
                    : "border-border-subtle text-text-secondary hover:border-border-strong hover:bg-state-hover"
            }`}
        >
            {label}
        </button>
    );

    return (
        <>
            {plugin ? (
            <ConfigExplorerModal
                open={open}
                onClose={onClose}
                title={`Plugin · ${plugin.id}`}
                subtitle={plugin.name}
                footerSummary={`${plugin.skillSlugs.length} skills • ${plugin.connectorIds.length} connectors`}
                footerExtra={
                    <div className="flex flex-wrap items-center gap-2">
                        {workspacePluginActions ? (
                            workspacePluginActions.installed ? (
                                <button
                                    type="button"
                                    disabled={workspacePluginActions.busy}
                                    onClick={() => {
                                        if (
                                            !confirm(
                                                `Remove plugin "${plugin.id}" from this workspace?`,
                                            )
                                        ) {
                                            return;
                                        }
                                        workspacePluginActions.onRemove();
                                    }}
                                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                                >
                                    {workspacePluginActions.busy ? "…" : "Remove from workspace"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={workspacePluginActions.busy}
                                    onClick={() => workspacePluginActions.onInstall()}
                                    className={buttonVariants({ variant: "primary", size: "sm" })}
                                >
                                    {workspacePluginActions.busy ? "…" : "Install for workspace"}
                                </button>
                            )
                        ) : null}
                        {workspacePluginActions ? (
                            <Link
                                href={`/app/${workspacePluginActions.workspaceId}/plugins`}
                                className={buttonVariants({ variant: "secondary", size: "sm" })}
                            >
                                Workspace plugins
                            </Link>
                        ) : null}
                        <Link
                            href="/app/config/skills"
                            className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                            Skills library
                        </Link>
                    </div>
                }
            >
                <div className="flex flex-wrap gap-2">
                    {tabBtn("overview", "Overview")}
                    {tabBtn("connectors", `Connectors (${plugin.connectorIds.length})`)}
                </div>

                {tab === "overview" && (
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs text-text-muted">{plugin.publisher}</p>
                            {plugin.externalUrl && (
                                <a
                                    href={plugin.externalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
                                >
                                    View provider <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            )}
                            <p className="mt-4 max-w-3xl text-sm text-text-secondary">{plugin.description}</p>
                        </div>

                        {plugin.samplePrompts && plugin.samplePrompts.length > 0 && (
                            <section>
                                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    Try asking
                                </h2>
                                <ul className="space-y-2">
                                    {plugin.samplePrompts.map((q) => (
                                        <li
                                            key={q}
                                            className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary"
                                        >
                                            {q}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <section>
                            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                Skills ({plugin.skillSlugs.length})
                            </h2>
                            <p className="mb-3 text-xs text-text-muted">
                                Click a skill to view details. Edit or create skills in the{" "}
                                <Link href="/app/config/skills" className="underline">
                                    skills library
                                </Link>
                                .
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {plugin.skillSlugs.map((slug) => (
                                    <button
                                        key={slug}
                                        type="button"
                                        onClick={() => void openSkillDialog(slug)}
                                        className="rounded bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                                    >
                                        {slug}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                Connectors ({plugin.connectorIds.length})
                            </h2>
                            <p className="mb-3 text-xs text-text-muted">
                                Connect these per workspace via MCP integrations. Open the{" "}
                                <button
                                    type="button"
                                    onClick={() => setTab("connectors")}
                                    className="underline hover:text-text-primary"
                                >
                                    Connectors
                                </button>{" "}
                                tab to browse definitions.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {plugin.connectorIds.map((id) => (
                                    <span
                                        key={id}
                                        className="rounded-full border border-border-subtle px-2 py-0.5 text-[11px] text-text-secondary"
                                    >
                                        {id}
                                    </span>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {tab === "connectors" && <PluginConnectorsPanel plugin={plugin} />}
            </ConfigExplorerModal>
            ) : null}

            <ConfigExplorerModal
                open={skillDialog.open}
                onClose={closeSkillDialog}
                title={sd ? `Skill: ${sd.slug}` : undefined}
                subtitle={sd?.loading ? "Loading…" : sd?.skill?.name ?? (sd ? "Skill" : undefined)}
                footerSummary={skillFooterSummary}
                footerExtra={
                    <Link
                        href="/app/config/skills"
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                        Skills library
                    </Link>
                }
            >
                {sd?.loading && (
                    <Panel className="p-4">
                        <p className="text-xs text-text-muted">Loading skill…</p>
                    </Panel>
                )}
                {sd?.error && (
                    <Panel className="border-status-error-border bg-status-error-bg/30 p-4">
                        <p className="text-xs text-status-error-text">{sd.error}</p>
                    </Panel>
                )}
                {sd?.skill && (
                    <>
                        {sd.skill.description ? (
                            <Panel className="p-4">
                                <p className="text-xs text-text-secondary">{sd.skill.description}</p>
                            </Panel>
                        ) : null}

                        <ConfigExplorerSection title="Skill" icon={ListTree} variant="divided">
                            <ConfigExplorerRow
                                title={sd.skill.name}
                                subtitle={`tags: ${sd.skill.tags.length ? sd.skill.tags.join(", ") : "none"} • extends: ${sd.skill.extends?.length ? sd.skill.extends.join(", ") : "—"}`}
                                badge={sd.skill.slug}
                            />
                        </ConfigExplorerSection>

                        <ConfigExplorerSection title="Tools" icon={Wrench} variant="divided">
                            <ConfigExplorerRow
                                title="Required tools"
                                subtitle={
                                    sd.skill.requiredTools.length ? sd.skill.requiredTools.join(", ") : "—"
                                }
                                badge={String(sd.skill.requiredTools.length)}
                            />
                            <ConfigExplorerRow
                                title="Suggested tools"
                                subtitle={
                                    sd.skill.suggestedTools.length ? sd.skill.suggestedTools.join(", ") : "—"
                                }
                                badge={String(sd.skill.suggestedTools.length)}
                            />
                        </ConfigExplorerSection>

                        <ConfigExplorerSection title="Instructions" icon={ScrollText} variant="stack">
                            <ConfigExplorerMonoBlock className="max-h-[min(420px,50vh)] overflow-auto whitespace-pre-wrap text-text-primary">
                                {sd.skill.body}
                            </ConfigExplorerMonoBlock>
                        </ConfigExplorerSection>
                    </>
                )}
            </ConfigExplorerModal>
        </>
    );
}
