"use client";

import Link from "next/link";
import { History, ArrowRight, BookOpen } from "lucide-react";
import { Panel, Breadcrumbs, buttonVariants } from "@kletron/ui/components/design-system";
import { RequireWorkspace } from "@kletron/ui/components/workspace/RequireWorkspace";
import { ActiveWorkspaceBanner } from "@kletron/ui/components/workspace/ActiveWorkspaceBanner";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";

const CHANGES_URL = "http://localhost:3000/app/changes";

export default function ChangesPage() {
    return (
        <RequireWorkspace message="Select a workspace before running Code Comparator workflows.">
            <ChangesPageContent />
        </RequireWorkspace>
    );
}

function ChangesPageContent() {
    const { activeWorkspace } = useWorkspace();

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <ActiveWorkspaceBanner />
            <div className="shrink-0 flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <History className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Code Comparator</h1>
                        <p className="text-sm text-text-muted">
                            Human anchor for diff and history workflows (agent skill + graph)
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6 pb-10">
                <div className="mb-6">
                    <Breadcrumbs />
                </div>

                <Panel className="max-w-2xl space-y-6 p-6">
                    <p className="text-sm text-text-secondary leading-relaxed">
                        Compare commits and patches through the{" "}
                        <strong className="text-text-primary">Code Comparator (agent graph)</strong> with builtin skill{" "}
                        <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs">code-comparator</code>. The agent
                        uses Git MCP tools (<code className="text-xs">git_log</code>,{" "}
                        <code className="text-xs">git_diff</code>, <code className="text-xs">git_grep</code>, and related
                        readers) on the active workspace.
                    </p>

                    <div className="rounded-lg border border-border-subtle bg-bg-elevated/80 px-4 py-3 text-xs text-text-muted">
                        <div className="mb-1 flex items-center gap-2 font-semibold text-text-secondary">
                            <BookOpen className="h-3.5 w-3.5" />
                            Bookmark URL
                        </div>
                        <code className="break-all font-mono text-text-primary">{CHANGES_URL}</code>
                    </div>

                    <div className="text-xs text-text-muted">
                        Active workspace root:{" "}
                        <span className="font-mono text-text-secondary">{activeWorkspace?.rootPath ?? "—"}</span>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                        <Link
                            href="/app/agent"
                            className={buttonVariants({ variant: "primary", size: "sm", className: "inline-flex items-center gap-2 no-underline" })}
                        >
                            Open Agent
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href="/app/automations"
                            className={buttonVariants({ variant: "secondary", size: "sm", className: "inline-flex items-center no-underline" })}
                        >
                            Automations
                        </Link>
                    </div>
                </Panel>
            </div>
        </div>
    );
}
