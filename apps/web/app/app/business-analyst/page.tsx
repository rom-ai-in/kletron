"use client";

import { BADashboardView } from "@numezis/ui/components/ba/BADashboardView";
import { RequireWorkspace } from "@numezis/ui/components/workspace/RequireWorkspace";

export default function BusinessAnalystDashboardPage() {
    return (
        <RequireWorkspace message="Select a workspace to analyze its codebase and manage features.">
            <BADashboardView />
        </RequireWorkspace>
    );
}
