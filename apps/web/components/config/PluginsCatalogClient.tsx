"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Puzzle, Search } from "lucide-react";
import { listPlugins, getPlugin } from "@kletron/shared";
import { Input, Panel } from "@kletron/ui/components/design-system";
import { PluginCatalogModal } from "./PluginCatalogModal";

export function PluginsCatalogClient() {
    const plugins = listPlugins();
    const [openId, setOpenId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const openPlugin = openId ? (getPlugin(openId) ?? null) : null;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return plugins;
        return plugins.filter(
            (p) =>
                p.id.includes(q) ||
                p.name.toLowerCase().includes(q) ||
                p.publisher.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q)
        );
    }, [plugins, query]);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-bg-app">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
                        <Puzzle className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-text-primary">Plugins</h1>
                        <p className="text-sm text-text-muted">
                            Cowork-style bundles of skills and connectors. Install per workspace from
                            workspace settings; open a bundle to browse definitions.
                        </p>
                    </div>
                </div>
                <div className="shrink-0 text-xs text-text-muted">
                    {plugins.length} {plugins.length === 1 ? "bundle" : "bundles"}
                </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6 scrollbar-elegant">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Input
                        leftIcon={Search}
                        placeholder="Search by name, publisher, or id…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        fullWidth
                        size="sm"
                        containerClassName="lg:max-w-md"
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setOpenId(p.id)}
                            className="group w-full text-left"
                        >
                            <Panel className="h-full p-4 transition-colors group-hover:border-border-strong">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Puzzle className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                                            <h2 className="text-sm font-semibold text-text-primary">{p.name}</h2>
                                        </div>
                                        <p className="mt-1 line-clamp-3 text-xs text-text-secondary">{p.description}</p>
                                        <p className="mt-3 text-[11px] text-text-muted">
                                            {p.skillSlugs.length} skills · {p.connectorIds.length} connectors ·{" "}
                                            {p.publisher}
                                        </p>
                                    </div>
                                    <div className="mt-0.5 shrink-0 text-text-muted transition-colors group-hover:text-text-primary">
                                        <ArrowRight className="h-4 w-4" aria-hidden />
                                    </div>
                                </div>
                            </Panel>
                        </button>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <Panel className="p-6 text-center">
                        <p className="text-sm text-text-secondary">No plugins match your search.</p>
                    </Panel>
                )}

                <Panel className="p-4">
                    <p className="text-xs text-text-secondary">
                        To enable a plugin for a workspace, open that workspace&apos;s{" "}
                        <span className="font-mono text-text-muted">Plugins</span> page and install from this catalog.
                    </p>
                </Panel>
            </div>

            <PluginCatalogModal
                plugin={openPlugin}
                open={Boolean(openId && openPlugin)}
                onClose={() => setOpenId(null)}
            />
        </div>
    );
}
