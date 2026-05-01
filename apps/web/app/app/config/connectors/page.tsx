"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@kletron/ui/components/ui/Card";
import { Input } from "@kletron/ui/components/ui/Input";
import { Search, ExternalLink } from "lucide-react";
import { useConnectorCatalog } from "../../../../hooks/useConnectors";

export default function ConnectorsCatalogPage() {
    const { types, isLoading, error } = useConnectorCatalog();
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return types;
        return types.filter(
            (t) =>
                t.id.includes(q) ||
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.category.includes(q)
        );
    }, [types, search]);

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
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-text-primary">Connectors</h1>
                <p className="text-text-muted mt-1">
                    Catalog of available SaaS integrations and external MCP server templates.
                    Connect them per workspace from the workspace connectors page.
                </p>
            </div>

            <div className="mb-6">
                <Input
                    leftIcon={Search}
                    placeholder="Search providers"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    fullWidth
                />
            </div>

            {error && (
                <p className="mb-4 text-sm text-status-error-text">Error: {error}</p>
            )}
            {isLoading ? (
                <p className="text-text-muted">Loading catalog...</p>
            ) : (
                <div className="space-y-8">
                    {grouped.map(([category, items]) => (
                        <section key={category}>
                            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                {category}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {items.map((def) => (
                                    <Card
                                        key={def.id}
                                        className="border-border-subtle bg-bg-surface"
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-text-primary">
                                                        {def.name}
                                                    </h3>
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
                                            <p className="mt-2 text-xs text-text-secondary">
                                                {def.description}
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-1">
                                                {def.unlocksTools.slice(0, 4).map((t) => (
                                                    <span
                                                        key={t}
                                                        className="rounded bg-bg-elevated px-2 py-0.5 text-[10px] font-mono text-text-muted"
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
