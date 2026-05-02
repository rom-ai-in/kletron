"use client";

import { unwrapRouteParams } from "../../../../lib/unwrapRouteParams";
import { PluginsCatalogClient } from "../../../../components/config/PluginsCatalogClient";

export default function WorkspacePluginsPage({
    params,
}: {
    params: Promise<{ workspaceId: string }> | { workspaceId: string };
}) {
    const { workspaceId } = unwrapRouteParams(params);
    return (
        <div className="flex h-full min-h-0 flex-col">
            <PluginsCatalogClient workspaceId={workspaceId} />
        </div>
    );
}
