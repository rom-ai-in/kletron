"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Card, CardContent } from "@kletron/ui/components/ui/Card";
import { Button } from "@kletron/ui/components/ui/Button";
import { useWorkspacePlugins } from "../../../../hooks/useWorkspacePlugins";

export default function WorkspacePluginsPage({
    params,
}: {
    params: Promise<{ workspaceId: string }>;
}) {
    const { workspaceId } = use(params);
    const { plugins, installed, isLoading, error, setInstalled } = useWorkspacePlugins(workspaceId);
    const [busy, setBusy] = useState<string | null>(null);

    const onInstall = async (pluginId: string) => {
        setBusy(pluginId);
        try {
            await setInstalled(pluginId, "install");
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setBusy(null);
        }
    };

    const onRemove = async (pluginId: string) => {
        setBusy(pluginId);
        try {
            await setInstalled(pluginId, "remove");
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">Workspace Plugins</h1>
                    <p className="text-text-muted mt-1">
                        Install a bundle to enable its skills; connect integrations from{" "}
                        <Link href={`/app/${workspaceId}/connectors`} className="underline">
                            Connectors
                        </Link>
                        .
                    </p>
                </div>
                <Link
                    href="/app/config/plugins"
                    className="text-sm text-text-secondary underline"
                >
                    Browse catalog
                </Link>
            </div>

            {error && (
                <p className="mb-4 text-sm text-status-error-text">Error: {error}</p>
            )}
            {isLoading ? (
                <p className="text-text-muted">Loading plugins...</p>
            ) : (
                <div className="space-y-3">
                    {plugins.map((p) => {
                        const on = installed[p.id];
                        return (
                            <Card key={p.id} className="border-border-subtle bg-bg-surface">
                                <CardContent className="p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-sm font-semibold text-text-primary">
                                                    {p.name}
                                                </h2>
                                                <span className="text-[11px] text-text-muted">
                                                    {p.publisher}
                                                </span>
                                                {on && (
                                                    <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] text-status-success-text">
                                                        Installed
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                                                {p.description}
                                            </p>
                                            <p className="mt-2 text-[11px] text-text-muted">
                                                {p.skillSlugs.length} skills · {p.connectorIds.length}{" "}
                                                connectors
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            <Link
                                                href={`/app/${workspaceId}/connectors?plugin=${encodeURIComponent(p.id)}`}
                                                className="inline-flex h-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated px-3 text-[11px] font-medium text-text-primary hover:bg-state-hover"
                                            >
                                                Connectors
                                            </Link>
                                            {on ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={busy === p.id}
                                                    onClick={() => void onRemove(p.id)}
                                                >
                                                    {busy === p.id ? "…" : "Remove"}
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    disabled={busy === p.id}
                                                    onClick={() => void onInstall(p.id)}
                                                >
                                                    {busy === p.id ? "…" : "Install"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
