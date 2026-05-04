"use client";

import { Suspense } from "react";
import { unwrapRouteParams } from "../../../../lib/unwrapRouteParams";
import { WorkspaceConnectorsManager } from "../../../../components/workspace/WorkspaceConnectorsManager";

export default function WorkspaceConnectorsPage({
    params,
}: {
    params: Promise<{ workspaceId: string }> | { workspaceId: string };
}) {
    const { workspaceId } = unwrapRouteParams(params);
    return (
        <Suspense
            fallback={
                <div className="flex h-full min-h-[40vh] items-center justify-center bg-bg-app px-4 text-sm text-text-muted">
                    Loading connectors…
                </div>
            }
        >
            <WorkspaceConnectorsManager workspaceId={workspaceId} />
        </Suspense>
    );
}
