"use client";

import type { AutomationExecutionContextDTO } from "@kletron/shared/automationExecutionContext";
import { CONNECTOR_CATALOG } from "@kletron/shared/connectors/catalog";
import { cn } from "@kletron/shared/utils/cn";
import { AlertTriangle, Boxes, Cpu, FolderGit2, Link2, Puzzle } from "lucide-react";

export interface AutomationExecutionContextPanelProps {
    context: AutomationExecutionContextDTO;
    /** Workspace currently selected in the app (header); used to warn if it differs from the automation owner. */
    activeWorkspaceId?: string | null;
    /** Link target for workspace connectors (default `/app/connectors`). */
    connectorsHref?: string;
    className?: string;
}

function connectorLabel(providerId: string): string {
    return CONNECTOR_CATALOG.find((c) => c.id === providerId)?.name ?? providerId;
}

function shortId(id: string, keep = 8): string {
    if (id.length <= keep + 3) return id;
    return `${id.slice(0, keep)}…`;
}

export function AutomationExecutionContextPanel({
    context,
    activeWorkspaceId,
    connectorsHref = "/app/connectors",
    className,
}: AutomationExecutionContextPanelProps) {
    const ownerId = context.automationWorkspaceId ?? context.workspaceId;
    const mismatch =
        activeWorkspaceId != null &&
        ownerId != null &&
        activeWorkspaceId !== ownerId;

    return (
        <div className={cn("space-y-4", className)}>
            <div className="rounded-lg border border-border-subtle bg-bg-surface p-4 space-y-3">
                <div className="flex items-start gap-2">
                    <FolderGit2 className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-xs font-semibold text-text-primary">Workspace</div>
                        <div className="text-sm font-medium text-text-primary truncate">{context.workspaceName}</div>
                        <div className="text-[11px] text-text-muted font-mono truncate" title={context.workspaceRootPath}>
                            {context.workspaceRootPath}
                        </div>
                        <div className="text-[10px] text-text-muted">
                            Workspace id <span className="font-mono">{shortId(context.workspaceId, 12)}</span>
                            {context.automationWorkspaceId && (
                                <>
                                    {" "}
                                    · stored on automation{" "}
                                    <span className="font-mono">{shortId(context.automationWorkspaceId, 12)}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {mismatch && (
                    <div className="flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning-bg/50 px-3 py-2 text-[11px] text-status-warning-text">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                            The automation is owned by a different workspace than the one selected in the app header.
                            Switch workspace or open this automation from the correct workspace.
                        </span>
                    </div>
                )}
                <a
                    href={connectorsHref}
                    className="inline-flex items-center gap-1.5 text-[11px] text-status-info-text hover:underline"
                >
                    <Link2 className="h-3.5 w-3.5" />
                    Connectors & skills for this workspace
                </a>
            </div>

            <div className="rounded-lg border border-border-subtle bg-bg-surface p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                    <Cpu className="h-3.5 w-3.5 text-text-muted" />
                    Runtime defaults
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                    <div>
                        <div className="text-text-muted uppercase tracking-wide text-[10px]">Work mode</div>
                        <div className="text-text-primary font-medium">{context.defaultWorkMode}</div>
                    </div>
                    <div>
                        <div className="text-text-muted uppercase tracking-wide text-[10px]">Skills</div>
                        <div className="text-text-primary font-medium">{context.skillCount}</div>
                    </div>
                    <div>
                        <div className="text-text-muted uppercase tracking-wide text-[10px]">MCP servers</div>
                        <div className="text-text-primary font-medium">{context.externalMcpServerCount}</div>
                    </div>
                    <div>
                        <div className="text-text-muted uppercase tracking-wide text-[10px]">Integrations</div>
                        <div className="text-text-primary font-medium">{context.integrationProviderIds.length}</div>
                    </div>
                </div>
                {context.integrationProviderIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {context.integrationProviderIds.map((id) => (
                            <span
                                key={id}
                                className="rounded border border-border-subtle bg-bg-elevated px-2 py-0.5 text-[10px] text-text-secondary"
                            >
                                {connectorLabel(id)}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <div className="text-xs font-semibold text-text-primary flex items-center gap-2 ml-1">
                    <Boxes className="h-3.5 w-3.5 text-text-muted" />
                    Stages (graphs & tools)
                </div>
                <div className="space-y-2">
                    {context.stages.map((s) => (
                        <div
                            key={`${s.stageId}-${s.stageIndex}`}
                            className="rounded-lg border border-border-subtle bg-bg-surface/80 p-3 space-y-2"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-text-primary">
                                        {s.stageIndex + 1}. {s.stageName}
                                    </div>
                                    <div className="text-[10px] text-text-muted font-mono truncate mt-0.5">
                                        graph: {s.resolvedGraphName ?? "—"}{" "}
                                        {s.resolvedGraphId && (
                                            <span className="text-text-muted">({shortId(s.resolvedGraphId, 10)})</span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-text-muted font-mono truncate">
                                        configured id: {s.configuredGraphId}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 text-[10px] text-text-muted">
                                    <Puzzle className="h-3 w-3" />
                                    {s.pinnedSkillIds.length > 0 ? s.pinnedSkillIds.join(", ") : "—"}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary">
                                <span>
                                    Tools in graph: <strong className="text-text-primary">{s.graphToolNamesRequested}</strong>
                                </span>
                                <span>
                                    Effective: <strong className="text-text-primary">{s.toolsEffectiveCount}</strong>
                                </span>
                                <span>
                                    Blocked:{" "}
                                    <strong
                                        className={
                                            s.toolsBlockedTotal > 0 ? "text-status-warning-text" : "text-text-primary"
                                        }
                                    >
                                        {s.toolsBlockedTotal}
                                    </strong>
                                </span>
                            </div>
                            {s.toolsBlockedTotal > 0 && s.toolsBlockedSample.length > 0 && (
                                <div className="text-[10px] text-status-warning-text font-mono break-all">
                                    {s.toolsBlockedSample.join(", ")}
                                    {s.toolsBlockedTotal > s.toolsBlockedSample.length &&
                                        ` · +${s.toolsBlockedTotal - s.toolsBlockedSample.length} more`}
                                </div>
                            )}
                        </div>
                    ))}
                    {context.stages.length === 0 && (
                        <div className="text-[11px] text-text-muted px-1">No stages configured.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
