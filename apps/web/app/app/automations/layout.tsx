"use client";

import { RequireWorkspace } from "@kletron/ui/components/workspace/RequireWorkspace";

/**
 * Single-column shell — the Claude-style index page *is* the list, and the
 * detail route opens full width with its own back control (no master list rail).
 */
export default function AutomationsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RequireWorkspace message="Select a workspace to manage automations and runs.">
            <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-bg-base">
                {children}
            </div>
        </RequireWorkspace>
    );
}
