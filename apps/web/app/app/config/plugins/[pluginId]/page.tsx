"use client";

import Link from "next/link";
import { use, useCallback, useState } from "react";
import {
    buttonVariants,
    ConfigExplorerModal,
    ConfigExplorerMonoBlock,
    ConfigExplorerRow,
    ConfigExplorerSection,
    Panel,
} from "@kletron/ui/components/design-system";
import { ExternalLink, Link as LinkIcon, ListTree, ScrollText, Wrench } from "lucide-react";
import { getPlugin, type SkillRecord } from "@kletron/shared";
import { notFound } from "next/navigation";

type SkillDialogState =
    | { open: false }
    | {
          open: true;
          slug: string;
          skill: SkillRecord | null;
          loading: boolean;
          error: string | null;
      };

export default function ConfigPluginDetailPage({
    params,
}: {
    params: Promise<{ pluginId: string }>;
}) {
    const { pluginId } = use(params);
    const plugin = getPlugin(pluginId);
    if (!plugin) notFound();

    const [skillDialog, setSkillDialog] = useState<SkillDialogState>({ open: false });

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
    const footerSummary =
        sd && !sd.loading && sd.skill
            ? `${sd.skill.source} • v${sd.skill.version}`
            : sd?.loading
              ? "Loading…"
              : "";

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <Link
                    href="/app/config/plugins"
                    className="text-sm text-text-secondary underline hover:text-text-primary"
                >
                    ← Plugins
                </Link>
                <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary">{plugin.name}</h1>
                        <p className="text-text-muted mt-1">{plugin.publisher}</p>
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
                    </div>
                    <Link
                        href={`/app/config/plugins/${plugin.id}/connectors`}
                        className={buttonVariants({ variant: "secondary", size: "md" })}
                    >
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Connectors for this plugin
                    </Link>
                </div>
                <p className="mt-4 max-w-3xl text-sm text-text-secondary">{plugin.description}</p>
            </div>

            {plugin.samplePrompts && plugin.samplePrompts.length > 0 && (
                <section className="mb-8">
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

            <section className="mb-8">
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
                    Connect these per workspace via MCP integrations.{" "}
                    <Link href={`/app/config/plugins/${plugin.id}/connectors`} className="underline">
                        Browse this plugin&apos;s connectors
                    </Link>
                    .
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

            <ConfigExplorerModal
                open={skillDialog.open}
                onClose={closeSkillDialog}
                title={sd ? `Skill: ${sd.slug}` : undefined}
                subtitle={
                    sd?.loading ? "Loading…" : sd?.skill?.name ?? (sd ? "Skill" : undefined)
                }
                footerSummary={footerSummary}
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
                                    sd.skill.requiredTools.length
                                        ? sd.skill.requiredTools.join(", ")
                                        : "—"
                                }
                                badge={String(sd.skill.requiredTools.length)}
                            />
                            <ConfigExplorerRow
                                title="Suggested tools"
                                subtitle={
                                    sd.skill.suggestedTools.length
                                        ? sd.skill.suggestedTools.join(", ")
                                        : "—"
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
        </div>
    );
}
