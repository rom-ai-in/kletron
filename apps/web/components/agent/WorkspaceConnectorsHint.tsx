"use client";

import Link from "next/link";
import type { GetRequestHeaders } from "@kletron/shared";
import {
  WorkspaceConnectorsHint as WorkspaceConnectorsHintBase,
  type WorkspaceConnectorsHintProps,
} from "@kletron/ui/components/CommandCenter/WorkspaceConnectorsHint";

type Props = Pick<WorkspaceConnectorsHintProps, "workspaceId" | "className">;

/**
 * Stable reference — inline async breaks `useWorkspaceConnectors` deps and causes fetch loops.
 * Desktop: same idea via `useStableAgentRequestHeaders` (Bearer + workspace).
 */
const webAgentConnectorHeaders: GetRequestHeaders = async () => ({});

/** Web agent: Next.js `Link` for connectors URLs (same as legacy local implementation). */
export function WorkspaceConnectorsHint({ workspaceId, className = "" }: Props) {
  return (
    <WorkspaceConnectorsHintBase
      apiOrigin=""
      workspaceId={workspaceId}
      getRequestHeaders={webAgentConnectorHeaders}
      className={className}
      connectorsHref="/app/config/connectors"
      renderConnectorsLink={({ href, className: cn, children }) => (
        <Link href={href} className={cn}>
          {children}
        </Link>
      )}
    />
  );
}
