"use client";

import type { ReactNode } from "react";
import DesignSystemShell from "../components/DesignSystemShell";
import { InspectorProvider } from "../components/Inspector";

export default function DesignSystemTabsLayout({ children }: { children: ReactNode }) {
    return (
        <InspectorProvider>
            <DesignSystemShell>{children}</DesignSystemShell>
        </InspectorProvider>
    );
}
