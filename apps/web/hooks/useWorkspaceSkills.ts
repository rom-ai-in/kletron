"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceSkillRecord, WorkspaceSkillView } from "@kletron/shared";

interface ResponseShape {
    workspaceId: string;
    activations: WorkspaceSkillRecord[];
    skills: WorkspaceSkillView[];
}

export function useWorkspaceSkills(workspaceId: string) {
    const [data, setData] = useState<ResponseShape | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!workspaceId) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/workspaces/${workspaceId}/skills`);
            if (!res.ok) throw new Error(`Failed to load workspace skills (${res.status})`);
            setData((await res.json()) as ResponseShape);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const updateActivation = useCallback(
        async (
            skillSlug: string,
            patch: { enabled?: boolean; autoLoadInNewThreads?: boolean },
        ) => {
            if (!workspaceId) return;
            const res = await fetch(`/api/workspaces/${workspaceId}/skills`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skillSlug, ...patch }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Failed to update activation (${res.status})`);
            }
            await refresh();
        },
        [workspaceId, refresh]
    );

    const setEnabled = useCallback(
        async (skillSlug: string, enabled: boolean) =>
            updateActivation(skillSlug, { enabled }),
        [updateActivation],
    );

    const setAutoLoadInNewThreads = useCallback(
        async (skillSlug: string, autoLoadInNewThreads: boolean) =>
            updateActivation(skillSlug, { autoLoadInNewThreads }),
        [updateActivation],
    );

    const remove = useCallback(
        async (skillSlug: string) => {
            if (!workspaceId) return;
            const res = await fetch(
                `/api/workspaces/${workspaceId}/skills/${encodeURIComponent(skillSlug)}`,
                { method: "DELETE" }
            );
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Failed to remove activation (${res.status})`);
            }
            await refresh();
        },
        [workspaceId, refresh]
    );

    return {
        skills: data?.skills ?? [],
        activations: data?.activations ?? [],
        isLoading,
        error,
        refresh,
        setEnabled,
        setAutoLoadInNewThreads,
        remove,
    };
}
