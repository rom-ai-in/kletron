"use client";

import React, { useMemo } from "react";
import { Plug } from "lucide-react";
import { useWorkspaceConnectors } from "../../hooks/useWorkspaceConnectors";
import type { GetRequestHeaders } from "@kletron/shared";

const MAX_CHIPS = 6;

export type WorkspaceConnectorsHintProps = {
  apiOrigin: string;
  workspaceId: string | null;
  getRequestHeaders?: GetRequestHeaders;
  className?: string;
  connectorsHref?: string;
  /**
   * When set (e.g. Electron), "Manage" / "Add connectors" invoke this instead of in-app navigation.
   */
  onOpenConnectors?: () => void;
  /**
   * Next.js `Link` or other router-aware anchor; takes precedence over `onOpenConnectors` for rendering.
   */
  renderConnectorsLink?: (props: {
    href: string;
    className?: string;
    children: React.ReactNode;
  }) => React.ReactNode;
};

/**
 * One-line hint under the agent composer: active integrations and MCP servers for the workspace.
 * Matches web agent chrome; use `renderConnectorsLink` for Next.js or `onOpenConnectors` for desktop.
 */
export function WorkspaceConnectorsHint({
  apiOrigin,
  workspaceId,
  getRequestHeaders,
  className = "",
  connectorsHref = "/app/config/connectors",
  onOpenConnectors,
  renderConnectorsLink,
}: WorkspaceConnectorsHintProps) {
  const { integrations, mcpServers, isLoading } = useWorkspaceConnectors({
    apiOrigin,
    workspaceId,
    getRequestHeaders,
    enabled: !!workspaceId,
  });

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

  const linkClassManage =
    "shrink-0 text-[10px] font-medium text-text-muted hover:text-text-primary hover:underline";
  const linkClassAdd = "text-[10px] font-medium text-brand-primary hover:underline";

  function connectorsLink(className: string, children: React.ReactNode) {
    if (renderConnectorsLink) {
      return renderConnectorsLink({ href: connectorsHref, className, children });
    }
    if (onOpenConnectors) {
      return (
        <button type="button" onClick={onOpenConnectors} className={className}>
          {children}
        </button>
      );
    }
    return (
      <a href={connectorsHref} className={className}>
        {children}
      </a>
    );
  }

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
          {connectorsLink(linkClassAdd, "Add connectors")}
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
          {connectorsLink(linkClassManage, "Manage")}
        </>
      )}
    </div>
  );
}
