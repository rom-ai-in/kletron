import { ReactNode } from "react";
import { RequireWorkspace } from "@kletron/ui/components/workspace/RequireWorkspace";

export default function BusinessAnalystLayout({ children }: { children: ReactNode }) {
    return (
        <RequireWorkspace message="Select a workspace to analyze business context, features, and market insights.">
            {children}
        </RequireWorkspace>
    );
}
