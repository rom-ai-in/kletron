"use client";

import Link from "next/link";
import { Panel } from "@kletron/ui/components/design-system";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import { WorkspaceSkillsManager } from "../../../components/workspace/WorkspaceSkillsManager";

export default function SkillsPage() {
    const { activeWorkspaceId, loading } = useWorkspace();

    if (loading) {
        return (
            <div className="flex h-full flex-col bg-bg-app">
                <div className="p-6 text-sm text-text-muted">Loading…</div>
            </div>
        );
    }

    if (!activeWorkspaceId) {
        return (
            <div className="flex h-full flex-col bg-bg-app">
                <div className="border-b border-border-subtle bg-bg-surface px-6 py-4">
                    <h1 className="text-lg font-semibold text-text-primary">Skills</h1>
                    <p className="text-sm text-text-muted">
                        Choose a workspace in the sidebar to manage skills.
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <Panel className="p-6">
                        <p className="text-sm text-text-primary">
                            No workspace is selected. Pick one in the shell, or open workspace
                            settings.
                        </p>
                        <Link
                            href="/app/config/workspace"
                            className="mt-4 inline-block text-sm text-text-secondary underline"
                        >
                            Workspace settings
                        </Link>
                    </Panel>
                </div>
            </div>
        );
    }

    return <WorkspaceSkillsManager workspaceId={activeWorkspaceId} />;
}
