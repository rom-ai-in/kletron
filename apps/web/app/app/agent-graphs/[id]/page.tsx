export const dynamic = "force-dynamic";

import { Suspense } from "react";

import AgentGraphDetailClient from "./AgentGraphDetailClient";

export default function AgentGraphDetailPage({ params }: { params: { id: string } }) {
    return (
        <Suspense
            fallback={<div className="p-6 text-xs text-text-muted">Loading graph editor…</div>}
        >
            <AgentGraphDetailClient params={params} />
        </Suspense>
    );
}

