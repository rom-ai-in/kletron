"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
    AutomationsClaudePage,
    type AutomationsClaudeItem,
} from "@kletron/ui/components/automations/AutomationsClaudePage";
import { AutomationBuilderModal } from "@kletron/ui/components/AutomationBuilderModal";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import type { AutomationDefinition } from "@kletron/shared/automationTypes";
import { describeCron } from "@kletron/shared/cronUtils";

/** A stage without a prompt blocks execution — surfaced as a warning on the row. */
function isBlocked(automation: AutomationDefinition): boolean {
    return !!automation.stages?.some((stage) => !stage.prompt || stage.prompt.trim() === "");
}

function triggerLabelOf(automation: AutomationDefinition): string | undefined {
    if ((automation.triggerType ?? "manual") !== "schedule" || !automation.schedule) return undefined;
    const { cron, timezone, enabled } = automation.schedule;
    const description = describeCron(cron);
    return [enabled ? description : `${description} · paused`, timezone].filter(Boolean).join(" · ");
}

/** Only schedule-driven, fully configured automations can be flipped from this page. */
function toggleableEnabled(automation: AutomationDefinition): boolean | undefined {
    if ((automation.triggerType ?? "manual") !== "schedule" || !automation.schedule) return undefined;
    if (isBlocked(automation)) return undefined;
    return automation.schedule.enabled;
}

export default function AutomationsPage() {
    const router = useRouter();
    const { activeWorkspaceId, activeWorkspace } = useWorkspace() ?? {};

    const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [builderOpen, setBuilderOpen] = useState(false);

    const fetchAutomations = useCallback(
        async (opts?: { silent?: boolean }) => {
            if (!activeWorkspaceId) {
                setAutomations([]);
                setLoading(false);
                setError(null);
                return;
            }
            if (!opts?.silent) setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/automations", {
                    headers: { "x-workspace-id": activeWorkspaceId },
                    cache: "no-store",
                });
                if (!res.ok) {
                    const body = (await res.json().catch(() => ({}))) as Record<string, string>;
                    throw new Error(body.message || body.error || "Failed to load automations");
                }
                const data = await res.json();
                setAutomations(data.automations || data.chains || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load automations");
            } finally {
                setLoading(false);
            }
        },
        [activeWorkspaceId],
    );

    useEffect(() => {
        void fetchAutomations();
        const interval = setInterval(() => {
            if (document.visibilityState !== "visible") return;
            void fetchAutomations({ silent: true });
        }, 45_000);
        return () => clearInterval(interval);
    }, [fetchAutomations]);

    const items = useMemo<AutomationsClaudeItem[]>(
        () =>
            automations.map((automation) => ({
                id: automation._id?.toString() ?? "",
                name: automation.name,
                description: automation.description,
                triggerType: automation.triggerType ?? "manual",
                triggerLabel: triggerLabelOf(automation),
                enabled: toggleableEnabled(automation),
                nextRunAt: automation.schedule?.nextScheduledAt ?? null,
                lastRunAt: automation.schedule?.lastScheduledAt ?? null,
                needsAttention: isBlocked(automation),
            })),
        [automations],
    );

    /**
     * Flipping the switch republishes the whole config (the only update the API
     * takes), so keep the optimistic state and roll back on failure.
     */
    const handleToggleEnabled = useCallback(
        async (id: string, next: boolean) => {
            const automation = automations.find((a) => a._id?.toString() === id);
            if (!automation?.schedule) return;

            setAutomations((prev) =>
                prev.map((a) =>
                    a._id?.toString() === id && a.schedule
                        ? { ...a, schedule: { ...a.schedule, enabled: next } }
                        : a,
                ),
            );

            try {
                const res = await fetch(`/api/automations/${id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...(activeWorkspaceId ? { "x-workspace-id": activeWorkspaceId } : {}),
                    },
                    body: JSON.stringify({
                        config: {
                            name: automation.name,
                            description: automation.description,
                            stages: automation.stages,
                            triggerType: automation.triggerType,
                            schedule: {
                                enabled: next,
                                cron: automation.schedule.cron,
                                timezone: automation.schedule.timezone,
                                ...(automation.schedule.maxRuns ? { maxRuns: automation.schedule.maxRuns } : {}),
                            },
                            webhookConfig: automation.webhookConfig,
                            gitEventConfig: automation.gitEventConfig,
                        },
                    }),
                });
                if (!res.ok) {
                    const body = (await res.json().catch(() => ({}))) as Record<string, string>;
                    throw new Error(body.error || "Could not update the schedule");
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Could not update the schedule");
                void fetchAutomations({ silent: true });
            }
        },
        [automations, activeWorkspaceId, fetchAutomations],
    );

    return (
        <>
            <AutomationsClaudePage
                items={items}
                loading={loading}
                error={error}
                onRetry={() => void fetchAutomations()}
                onSelect={(id) => router.push(`/app/automations/${id}`)}
                onCreate={() => setBuilderOpen(true)}
                onToggleEnabled={(id, next) => void handleToggleEnabled(id, next)}
                workspaceName={activeWorkspace?.name}
            />

            <AutomationBuilderModal
                open={builderOpen}
                onClose={() => setBuilderOpen(false)}
                onCreated={(id: string) => {
                    setBuilderOpen(false);
                    void fetchAutomations({ silent: true });
                    router.push(`/app/automations/${id}`);
                }}
            />
        </>
    );
}
