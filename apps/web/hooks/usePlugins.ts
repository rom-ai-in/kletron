"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginDefinition } from "@kletron/shared";

export function usePluginsCatalog() {
    const [plugins, setPlugins] = useState<PluginDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/plugins");
            if (!res.ok) throw new Error(`Failed (${res.status})`);
            const json = await res.json();
            setPlugins(json.plugins ?? []);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { plugins, isLoading, error, refresh };
}
