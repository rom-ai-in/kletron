export const dynamic = "force-dynamic";

import AgentGraphDetailClient from "./AgentGraphDetailClient";

export default function AgentGraphDetailPage({ params }: { params: { id: string } }) {
    return <AgentGraphDetailClient params={params} />;
}

