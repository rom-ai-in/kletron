"use client";

import { notFound } from "next/navigation";
import {
    LegacyWorkspaceScopedRedirect,
    type LegacyWorkspaceScopedSegment,
} from "../../../../components/workspace/LegacyWorkspaceScopedRedirect";
import { unwrapRouteParams } from "../../../../lib/unwrapRouteParams";

/** Single segment after `/app/:workspaceId/` supported for backwards-compatible URLs. */
const LEGACY_SEGMENT_MAP: Record<string, LegacyWorkspaceScopedSegment> = {
    skills: "skills",
    connectors: "connectors",
    plugins: "plugins",
    settings: "settings",
    workbench: "workbench",
};

function resolveLegacySegment(legacy: string[] | undefined): LegacyWorkspaceScopedSegment | null {
    if (!legacy || legacy.length === 0) {
        return "workbench";
    }
    if (legacy.length !== 1) {
        return null;
    }
    return LEGACY_SEGMENT_MAP[legacy[0]] ?? null;
}

/**
 * Consolidated legacy router: `/app/:workspaceId`, `/app/:workspaceId/skills`, etc.
 * Selects the workspace then redirects to the canonical `/app/*` route.
 */
export default function LegacyWorkspaceDeepLinkPage({
    params,
}: {
    params:
        | Promise<{ workspaceId: string; legacy?: string[] }>
        | { workspaceId: string; legacy?: string[] };
}) {
    const { workspaceId, legacy } = unwrapRouteParams(params);
    const segment = resolveLegacySegment(legacy);
    if (!segment) {
        notFound();
    }

    return (
        <LegacyWorkspaceScopedRedirect
            params={{ workspaceId }}
            segment={segment}
        />
    );
}
