"use client";

import { Github, Loader2, Plug } from "lucide-react";
import { useWorkspaceConnectors } from "../../hooks/useWorkspaceConnectors";
import type { GetRequestHeaders } from "@kletron/shared";

type Props = {
  apiOrigin: string;
  workspaceId: string | null;
  getRequestHeaders: GetRequestHeaders;
  /** Opens `/app/config/connectors` on the web app (same origin as API). */
  onOpenConnectorsPortal: () => void;
};

/**
 * Code-mode GitHub connector status — mirrors web `AgentCodeRepoBar` using shared fetch logic.
 */
export function CodeRepoConnectorStrip({
  apiOrigin,
  workspaceId,
  getRequestHeaders,
  onOpenConnectorsPortal,
}: Props) {
  const { integrations, isLoading, error } = useWorkspaceConnectors({
    apiOrigin,
    workspaceId,
    getRequestHeaders,
    enabled: !!workspaceId,
  });
  const github = integrations.find((i) => i.providerId === "github");
  const connected = github?.status === "active";

  if (!workspaceId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-bg-elevated/80 px-2.5 py-1.5 text-[10px] text-text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
        <span>GitHub status…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-bg-elevated/80 px-2.5 py-1.5 text-[10px] text-text-muted"
        title={error}
      >
        <Github className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        <span>Connectors unavailable</span>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-status-success-border/40 bg-status-success-bg/20 px-2.5 py-1.5 text-[10px] text-text-secondary">
        <Github className="h-3.5 w-3.5 shrink-0 text-text-primary" aria-hidden />
        <span className="truncate">
          GitHub connected
          {github?.displayName ? ` · ${github.displayName}` : ""}
        </span>
        <button
          type="button"
          onClick={onOpenConnectorsPortal}
          className="shrink-0 text-accent underline-offset-2 hover:underline"
        >
          Manage
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-bg-elevated/80 px-2.5 py-1.5 text-[10px] text-text-muted">
      <Plug className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      <span>GitHub not connected for this workspace.</span>
      <button
        type="button"
        onClick={onOpenConnectorsPortal}
        className="shrink-0 font-medium text-accent underline-offset-2 hover:underline"
      >
        Connect
      </button>
    </div>
  );
}
