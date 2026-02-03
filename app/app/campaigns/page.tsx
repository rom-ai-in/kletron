"use client";

import { EmptyState } from "@/src/components/design-system";
import { Layers } from "lucide-react";

export default function CampaignsPage() {
    return (
        <div className="flex h-full items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
            <EmptyState
                icon={<Layers className="h-6 w-6" />}
                title="No Campaign Selected"
                description="Select a campaign from the sidebar to view details, execution history, and configuration."
                variant="no-data"
            />
        </div>
    );
}
