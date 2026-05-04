"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plug } from "lucide-react";
import { useWorkspaceConnectors } from "../../hooks/useConnectors";

const MAX_CHIPS = 6;

/**
 * One-line hint under the agent composer: which integrations / MCP servers are active for this workspace.
 */
export function WorkspaceConnectorsHint({
  workspaceId,
  className = "",
}: {
  workspaceId: string | null;
  className?: string;
}) {
  const { integrations, mcpServers, isLoading } = useWorkspaceConnectors(workspaceId ?? "");

  const activeLabels = useMemo(() => {
    const labels: string[] = [];
    for (const i of integrations) {
      if (i.status === "active") {
        labels.push((i.displayName || i.providerId).trim());
      }
    }
    for (const m of mcpServers) {
      if (m.enabled && m.status !== "disabled") {
        labels.push(m.name.trim());
      }
    }
    labels.sort((a, b) => a.localeCompare(b));
    return labels;
  }, [integrations, mcpServers]);

  if (!workspaceId) return null;

  const href = `/app/${encodeURIComponent(workspaceId)}/connectors`;

  return (
    <div
      className={`mx-auto flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 px-0.5 ${className}`}
      aria-label="Active workspace connectors"
    >
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
        <Plug className="h-3 w-3 opacity-70" aria-hidden />
        <span>Connectors</span>
      </div>
      {isLoading ? (
        <span className="text-[10px] text-text-muted/80">Loading…</span>
      ) : activeLabels.length === 0 ? (
        <>
          <span className="text-[10px] text-text-muted">None active for this workspace.</span>
          <Link
            href={href}
            className="text-[10px] font-medium text-brand-primary hover:underline"
          >
            Add connectors
          </Link>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {activeLabels.slice(0, MAX_CHIPS).map((label, idx) => (
              <span
                key={`${label}:${idx}`}
                className="max-w-[10rem] truncate rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-text-secondary"
                title={label}
              >
                {label}
              </span>
            ))}
            {activeLabels.length > MAX_CHIPS ? (
              <span className="text-[10px] text-text-muted">
                +{activeLabels.length - MAX_CHIPS}
              </span>
            ) : null}
          </div>
          <Link
            href={href}
            className="shrink-0 text-[10px] font-medium text-text-muted hover:text-text-primary hover:underline"
          >
            Manage
          </Link>
        </>
      )}
    </div>
  );
}
