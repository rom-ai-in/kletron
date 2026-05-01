"use client";

import Link from "next/link";
import { use } from "react";
import { buttonVariants } from "@kletron/ui/components/ui/Button";
import { ExternalLink, Link as LinkIcon } from "lucide-react";
import { getPlugin } from "@kletron/shared";
import { notFound } from "next/navigation";

export default function ConfigPluginDetailPage({
    params,
}: {
    params: Promise<{ pluginId: string }>;
}) {
    const { pluginId } = use(params);
    const plugin = getPlugin(pluginId);
    if (!plugin) notFound();

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
                    Authoring in the{" "}
                    <Link href="/app/config/skills" className="underline">
                        skills library
                    </Link>
                    . Enable per workspace after install.
                </p>
                <div className="flex flex-wrap gap-2">
                    {plugin.skillSlugs.map((slug) => (
                        <Link
                            key={slug}
                            href={`/app/config/skills?search=${encodeURIComponent(slug)}`}
                            className="rounded bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-muted hover:text-text-primary"
                        >
                            {slug}
                        </Link>
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
        </div>
    );
}
