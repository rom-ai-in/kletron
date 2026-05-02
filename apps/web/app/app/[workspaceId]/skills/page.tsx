"use client";

import { unwrapRouteParams } from "../../../../lib/unwrapRouteParams";
import { WorkspaceSkillsManager } from "../../../../components/workspace/WorkspaceSkillsManager";

export default function WorkspaceSkillsPage({
    params,
}: {
    params: Promise<{ workspaceId: string }> | { workspaceId: string };
}) {
    const { workspaceId } = unwrapRouteParams(params);
    return <WorkspaceSkillsManager workspaceId={workspaceId} />;
}
