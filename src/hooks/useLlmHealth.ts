import { useState, useEffect, useCallback } from 'react';
import type { LlmProviderType } from "@/src/schemas/llmConfig.schema";

type LlmEnvInfo = {
    defaultProvider?: LlmProviderType;
    azure?: {
        configured: boolean;
        endpoint?: string | null;
        deployment?: string | null;
        model?: string | null;
        apiVersion?: string | null;
    };
    lmstudio?: {
        configured: boolean;
        baseUrl?: string | null;
        model?: string | null;
    };
};

type HealthStatus = 'success' | 'error' | 'loading' | 'none';

export function useLlmHealth(provider: string) {
    const [status, setStatus] = useState<HealthStatus>('none');
    const [message, setMessage] = useState<string | null>(null);

    const checkHealth = useCallback(async () => {
        setStatus('loading');
        setMessage(null);

        try {
            // 1. Fetch current effective configuration
            // We need both env and potentially DB config to know what to test
            // However, the simplest way is to fetch the "merged" config if the API supported it.
            // Since we don't know if there's a "get effective config" API, we'll try to fetch both like HeaderControls does.

            const [envRes, dbRes] = await Promise.all([
                fetch("/api/env"),
                fetch("/api/llm-config")
            ]);

            const envData = await envRes.json();
            const dbData = dbRes.ok ? await dbRes.json() : {};
            const envInfo = envData.llm as LlmEnvInfo;

            // Determine config to test
            const configToTest = provider === 'azure'
                ? (dbData?.azure ?? envInfo?.azure)
                : (dbData?.lmstudio ?? envInfo?.lmstudio);

            if (!configToTest) {
                setStatus('error');
                setMessage('No configuration found');
                return;
            }

            // 2. Test the connection
            const testRes = await fetch("/api/llm-config/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider,
                    config: configToTest,
                }),
            });

            const data = await testRes.json();
            if (!testRes.ok) throw new Error(data.error || "Connection refused");

            setStatus('success');
            setMessage(`Success! Latency: ${data.latency}ms`);

        } catch (error) {
            console.error("LLM Health Check Failed", error);
            setStatus('error');
            setMessage(error instanceof Error ? error.message : "Connection failed");
        }
    }, [provider]);

    // Initial check on mount or provider change
    useEffect(() => {
        checkHealth();
    }, [checkHealth]);

    return { status, message, recheck: checkHealth };
}
