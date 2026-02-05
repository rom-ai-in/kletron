"use client";

import { CampaignListSidebar } from "@numezis/ui/components/campaigns/CampaignListSidebar";

export default function CampaignsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-full w-full overflow-hidden bg-bg-base">
            {/* Persistent Master List */}
            <CampaignListSidebar />

            {/* Detail Pane / Empty State */}
            <main className="flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-bg-surface">
                {children}
            </main>
        </div>
    );
}
