export const dynamic = "force-dynamic";

import AgentGraphRunClient from "./AgentGraphRunClient";

export default function AgentGraphRunPage({ params }: { params: { id: string; runId: string } }) {
    return <AgentGraphRunClient params={params} />;
}

