"use client";

/** Used only by `app/app/[workspaceId]/[[...legacy]]/page.tsx` for old `/app/:id/...` URLs. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@kletron/ui/components/design-system";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import { useUnwrapRouteParams } from "../../lib/unwrapRouteParams";

const TARGETS = {
    skills: "/app/skills",
    connectors: "/app/config/connectors",
    plugins: "/app/plugins",
    settings: "/app/workspace",
    workbench: "/app/agent",
} as const;

export type LegacyWorkspaceScopedSegment = keyof typeof TARGETS;

export function LegacyWorkspaceScopedRedirect({
    params,
    segment,
}: {
    params: Promise<{ workspaceId: string }> | { workspaceId: string };
    segment: LegacyWorkspaceScopedSegment;
}) {
    const { workspaceId } = useUnwrapRouteParams(params);
    const { switchWorkspace, loading, activeWorkspaceId } = useWorkspace();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!workspaceId) {
            setError("Missing workspace id.");
            return;
        }
        if (loading) return;

        let cancelled = false;
        void (async () => {
            try {
                if (workspaceId !== activeWorkspaceId) {
                    await switchWorkspace(workspaceId);
                }
                if (cancelled) return;
                router.replace(TARGETS[segment]);
            } catch (e) {
                if (!cancelled) {
                    setError((e as Error).message ?? "Failed to open this workspace.");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [workspaceId, loading, activeWorkspaceId, segment, router, switchWorkspace]);

    if (error) {
        return (
            <div className="flex h-full flex-col bg-bg-app">
                <div className="border-b border-border-subtle bg-bg-surface px-6 py-4">
                    <h1 className="text-lg font-semibold text-text-primary">Workspace link</h1>
                    <p className="mt-1 text-sm text-status-error-text">{error}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <Panel className="p-6">
                        <p className="text-sm text-text-primary">
                            This link may be invalid or you may not have access to that workspace.
                        </p>
                        <Link
                            href="/app"
                            className="mt-4 inline-block text-sm text-text-secondary underline"
                        >
                            Back to app home
                        </Link>
                    </Panel>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-bg-app">
            <div className="p-6 text-sm text-text-muted">Opening workspace…</div>
        </div>
    );
}
