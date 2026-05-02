"use client";

import { listPlugins, getPlugin } from "@kletron/shared";
import { Card, CardContent } from "@kletron/ui/components/ui/Card";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { PluginCatalogModal } from "./PluginCatalogModal";

export function PluginsCatalogClient() {
    const plugins = listPlugins();
    const [openId, setOpenId] = useState<string | null>(null);
    const openPlugin = openId ? (getPlugin(openId) ?? null) : null;

    return (
        <>
            <div className="container mx-auto px-4 py-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-text-primary">Plugins</h1>
                    <p className="mt-1 text-text-muted">
                        Curated bundles of skills and connectors (Cowork-style). Install per workspace from the
                        workspace Plugins page; click a bundle to browse skills and connector definitions.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {plugins.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setOpenId(p.id)}
                            className="group w-full text-left"
                        >
                            <Card className="h-full border-border-subtle bg-bg-surface transition-colors group-hover:border-border-strong">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h2 className="text-sm font-semibold text-text-primary">{p.name}</h2>
                                            <p className="text-[11px] text-text-muted">{p.publisher}</p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 shrink-0 text-text-muted group-hover:text-text-primary" />
                                    </div>
                                    <p className="mt-2 line-clamp-3 text-xs text-text-secondary">{p.description}</p>
                                    <div className="mt-3 flex gap-3 text-[11px] text-text-muted">
                                        <span>{p.skillSlugs.length} skills</span>
                                        <span>{p.connectorIds.length} connectors</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </button>
                    ))}
                </div>
            </div>

            <PluginCatalogModal
                plugin={openPlugin}
                open={Boolean(openId && openPlugin)}
                onClose={() => setOpenId(null)}
            />
        </>
    );
}
