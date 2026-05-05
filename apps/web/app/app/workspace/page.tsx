"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@kletron/ui/components/ui/Card";
import { ArrowRight, Cog, Wrench, Link as LinkIcon } from "lucide-react";
import { Panel } from "@kletron/ui/components/design-system";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";

interface WorkspaceSummary {
    id: string;
    name: string;
    rootPath?: string;
}

export default function WorkspaceHubPage() {
    const { activeWorkspaceId, loading } = useWorkspace();
    const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activeWorkspaceId) return;
        const ac = new AbortController();
        (async () => {
            try {
                const res = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
                    signal: ac.signal,
                });
                if (!res.ok) throw new Error(`Failed (${res.status})`);
                const json = await res.json();
                const ws = json.workspace ?? json;
                setWorkspace(
                    ws
                        ? {
                              id: ws.id ?? ws._id ?? activeWorkspaceId,
                              name: ws.name,
                              rootPath: ws.rootPath,
                          }
                        : null,
                );
            } catch (err) {
                if ((err as Error).name !== "AbortError") setError((err as Error).message);
            }
        })();
        return () => ac.abort();
    }, [activeWorkspaceId]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <p className="text-sm text-text-muted">Loading…</p>
            </div>
        );
    }

    if (!activeWorkspaceId) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-text-primary">Workspace</h1>
                    <p className="mt-1 text-sm text-text-muted">
                        Choose a workspace in the sidebar to see settings shortcuts.
                    </p>
                </div>
                <Panel className="p-6">
                    <p className="text-sm text-text-primary">
                        No workspace is selected. Pick one in the shell, or open workspace settings.
                    </p>
                    <Link
                        href="/app/config/workspace"
                        className="mt-4 inline-block text-sm text-text-secondary underline"
                    >
                        Workspace settings
                    </Link>
                </Panel>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-text-primary">Workspace Settings</h1>
                {workspace && (
                    <p className="text-text-muted mt-1">
                        {workspace.name}
                        {workspace.rootPath && (
                            <span className="ml-2 font-mono text-xs">{workspace.rootPath}</span>
                        )}
                    </p>
                )}
                {error && <p className="mt-2 text-sm text-status-error-text">{error}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SettingsCard
                    title="Skills"
                    description="Activate which library skills the agent uses for this workspace."
                    href="/app/skills"
                    icon={<Wrench className="h-4 w-4" />}
                />
                <SettingsCard
                    title="Connectors"
                    description="Connect SaaS apps and external MCP servers."
                    href="/app/config/connectors"
                    icon={<LinkIcon className="h-4 w-4" />}
                />
                <SettingsCard
                    title="General"
                    description="Workspace name, root path, and default category."
                    href="/app/config/workspace"
                    icon={<Cog className="h-4 w-4" />}
                />
            </div>
        </div>
    );
}

function SettingsCard({
    title,
    description,
    href,
    icon,
}: {
    title: string;
    description: string;
    href: string;
    icon: React.ReactNode;
}) {
    return (
        <Link href={href} className="group">
            <Card className="border-border-subtle bg-bg-surface transition-colors group-hover:border-border-strong">
                <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div>
                        <div className="flex items-center gap-2">
                            {icon}
                            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">{description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-text-primary" />
                </CardContent>
            </Card>
        </Link>
    );
}
