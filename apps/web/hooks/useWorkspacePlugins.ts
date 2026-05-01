"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginDefinition } from "@kletron/shared";

interface ResponseShape {
    workspaceId: string;
    plugins: PluginDefinition[];
    installed: Record<string, boolean>;
}

export function useWorkspacePlugins(workspaceId: string) {
    const [data, setData] = useState<ResponseShape | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!workspaceId) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/workspaces/${workspaceId}/plugins`);
            if (!res.ok) throw new Error(`Failed (${res.status})`);
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

    const setInstalled = useCallback(
        async (pluginId: string, action: "install" | "remove") => {
            const res = await fetch(`/api/workspaces/${workspaceId}/plugins`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pluginId, action }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Failed (${res.status})`);
            }
            await refresh();
        },
        [workspaceId, refresh]
    );

    return {
        plugins: data?.plugins ?? [],
        installed: data?.installed ?? {},
        isLoading,
        error,
        refresh,
        setInstalled,
    };
}
