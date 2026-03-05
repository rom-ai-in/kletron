"use client";

import { AutomationListSidebar } from "@numezis/ui/components/automations/AutomationListSidebar";
import { RequireWorkspace } from "@numezis/ui/components/workspace/RequireWorkspace";

export default function AutomationsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RequireWorkspace message="Select a workspace to manage automations and runs.">
            <div className="flex h-full w-full overflow-hidden bg-bg-base">
                {/* Persistent Master List */}
                <AutomationListSidebar />

                {/* Detail Pane / Empty State */}
                <main className="flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-bg-surface">
                    {children}
                </main>
            </div>
        </RequireWorkspace>
    );
}
