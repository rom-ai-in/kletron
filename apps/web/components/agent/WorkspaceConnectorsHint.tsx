"use client";

import Link from "next/link";
import {
  WorkspaceConnectorsHint as WorkspaceConnectorsHintBase,
  type WorkspaceConnectorsHintProps,
} from "@kletron/ui/components/CommandCenter/WorkspaceConnectorsHint";

type Props = Pick<WorkspaceConnectorsHintProps, "workspaceId" | "className">;

/** Web agent: Next.js `Link` for connectors URLs (same as legacy local implementation). */
export function WorkspaceConnectorsHint({ workspaceId, className = "" }: Props) {
  return (
    <WorkspaceConnectorsHintBase
      apiOrigin=""
      workspaceId={workspaceId}
      getRequestHeaders={async () => ({})}
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
