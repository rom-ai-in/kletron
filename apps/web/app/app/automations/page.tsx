"use client";

import { EmptyState } from "@kletron/ui/components/design-system";
import { Layers } from "lucide-react";

export default function AutomationsPage() {
    return (
        <div className="flex h-full items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
            <EmptyState
                icon={<Layers className="h-6 w-6" />}
                title="No Automation Selected"
                description="Select an automation from the sidebar to view details, execution history, and configuration."
                variant="no-data"
            />
        </div>
    );
}
