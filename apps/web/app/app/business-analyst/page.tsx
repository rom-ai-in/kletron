"use client";

import { BADashboardView } from "@kletron/ui/components/ba/BADashboardView";
import { RequireWorkspace } from "@kletron/ui/components/workspace/RequireWorkspace";

export default function BusinessAnalystDashboardPage() {
    return (
        <RequireWorkspace message="Select a workspace to analyze its codebase and manage features.">
            <BADashboardView />
        </RequireWorkspace>
    );
}
