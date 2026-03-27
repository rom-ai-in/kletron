"use client";

import type { AutomationDefinition, AutomationStatus, AutomationTriggerType } from "@kletron/shared/automationTypes";
import { Panel, Button } from "@kletron/ui/components/design-system";

interface AutomationCardProps {
    automation: AutomationDefinition;
    onView?: () => void;
    onEdit?: () => void;
    onPause?: () => void;
    onStop?: () => void;
    onDelete?: () => void;
}

export function AutomationCard({ automation, onView, onEdit, onPause, onStop, onDelete }: AutomationCardProps) {
    const progress =
        automation.stages.length > 0
            ? ((automation.currentStageIndex / automation.stages.length) * 100).toFixed(0)
            : 0;

    const duration = automation.metadata?.totalDuration
        ? (automation.metadata.totalDuration / 1000 / 60).toFixed(1)
        : null;

    return (
        <Panel className="group p-4 transition hover:border-border-strong hover:bg-state-hover">
            <div className="flex items-start justify-between">
                {/* Left: Automation info */}
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-text-primary group-hover:text-text-primary transition">
                            {automation.name}
                        </h3>
                        <AutomationStatusBadge status={automation.status} />
                        {automation.status === "RUNNING" && (
                            <span className="text-sm text-text-muted">
                                {automation.currentStageIndex + 1}/{automation.stages.length}
                            </span>
                        )}
                    </div>

                    {automation.description && (
                        <p className="text-sm text-text-muted line-clamp-2">{automation.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-text-muted">
                        <span>{automation.stages.length} audit stages</span>
                        {duration && <span>{duration}m</span>}
                        {automation.metadata?.totalClaims && (
                            <span>
                                {automation.metadata.totalVerified}/{automation.metadata.totalClaims} verified
                            </span>
                        )}
                        <TriggerBadge triggerType={automation.triggerType} />
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={onView}>
                        View
                    </Button>
                    {automation.status !== "RUNNING" && onEdit && (
                        <Button size="sm" variant="secondary" onClick={onEdit}>
                            Edit
                        </Button>
                    )}
                    {automation.status === "RUNNING" && onPause && (
                        <Button size="sm" variant="secondary" onClick={onPause}>
                            Pause
                        </Button>
                    )}
                    {automation.status === "RUNNING" && onStop && (
                        <Button size="sm" variant="danger" onClick={onStop}>
                            Stop
                        </Button>
                    )}
                    {automation.status !== "RUNNING" && onDelete && (
                        <Button size="sm" variant="danger" onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Are you sure you want to delete this automation?")) {
                                onDelete();
                            }
                        }}>
                            Delete
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress bar (only for running automations) */}
            {automation.status === "RUNNING" && (
                <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                        <div
                            className="h-full bg-gradient-to-r from-status-success to-status-info transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}
        </Panel>
    );
}

function TriggerBadge({ triggerType }: { triggerType?: AutomationTriggerType }) {
    const config: Record<string, { label: string; style: string }> = {
        manual: { label: "Manual", style: "bg-bg-elevated text-text-muted border-border-subtle" },
        schedule: { label: "Scheduled", style: "bg-status-info-bg text-status-info-text border-status-info-border" },
        webhook: { label: "Webhook", style: "bg-status-warning-bg text-status-warning-text border-status-warning-border" },
        git_event: { label: "Git Event", style: "bg-status-success-bg text-status-success-text border-status-success-border" },
    };

    const trigger = triggerType || "manual";
    const { label, style } = config[trigger] || config.manual;

    return (
        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${style}`}>
            {label}
        </span>
    );
}

function AutomationStatusBadge({ status }: { status: AutomationStatus }) {
    const styles: Record<AutomationStatus, string> = {
        COMPLETED: "bg-status-success-bg text-status-success-text border-status-success-border",
        FAILED: "bg-status-error-bg text-status-error-text border-status-error-border",
        RUNNING: "bg-status-success-bg text-status-success-text border-status-success-border",
        PENDING: "bg-bg-elevated text-text-muted border-border-subtle",
        PAUSED: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
        CANCELLED: "bg-text-muted/10 text-text-secondary border-border-subtle",
    };

    return (
        <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}
        >
            {status === "RUNNING" && (
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            )}
            {status}
        </span>
    );
}
