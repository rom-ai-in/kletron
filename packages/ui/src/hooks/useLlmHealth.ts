import { useState, useEffect, useCallback, useRef } from 'react';

type HealthStatus = 'success' | 'error' | 'loading' | 'none';

// Module-level cache shared across all hook instances.
// Key = provider name, Value = { status, message, ts }.
const healthCache = new Map<string, { status: HealthStatus; message: string | null; ts: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Lightweight LLM health check hook.
 *
 * Instead of making a real LLM inference call on every page load,
 * it fetches the stored config and verifies that the provider is
 * configured (has required fields). Results are cached for 2 minutes.
 *
 * Call `recheck()` to force a fresh check (bypasses cache).
 */
export function useLlmHealth(provider: string) {
    const [status, setStatus] = useState<HealthStatus>(() => {
        const cached = provider ? healthCache.get(provider) : undefined;
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.status;
        return 'none';
    });
    const [message, setMessage] = useState<string | null>(() => {
        const cached = provider ? healthCache.get(provider) : undefined;
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.message;
        return null;
    });

    // Track the latest provider to avoid stale updates
    const providerRef = useRef(provider);
    providerRef.current = provider;

    const checkHealth = useCallback(async (bypassCache = false) => {
        if (!provider) {
            setStatus('none');
            setMessage('No provider selected');
            return;
        }

        // Return cached result if still fresh (unless bypassed)
        if (!bypassCache) {
            const cached = healthCache.get(provider);
            if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
                setStatus(cached.status);
                setMessage(cached.message);
                return;
            }
        }

        setStatus('loading');
        setMessage(null);

        try {
            // Fetch current LLM configuration (single lightweight request)
            const configRes = await fetch("/api/llm-config");

            if (!configRes.ok) {
                finish(provider, 'error', 'Failed to fetch LLM configuration');
                return;
            }

            const dbData = await configRes.json();

            // Determine config for this provider – use dynamic key lookup
            const configToTest: Record<string, unknown> | undefined = dbData?.[provider];

            if (!configToTest) {
                finish(provider, 'none', 'No configuration found');
                return;
            }

            // Check the "configured" flag if present
            const hasConfiguredFlag = typeof (configToTest as { configured?: boolean }).configured === 'boolean';
            if (hasConfiguredFlag && !(configToTest as { configured?: boolean }).configured) {
                finish(provider, 'none', 'Not configured');
                return;
            }

            // Lightweight validation: check that required fields exist
            const hasApiKey = !!(configToTest as any).apiKey;
            const hasBaseUrl = !!(configToTest as any).baseUrl;
            const hasEndpoint = !!(configToTest as any).endpoint;

            const needsKey = ['azure', 'openai', 'claude', 'gemini'].includes(provider);
            const needsUrl = ['lmstudio', 'ollama', 'vllm'].includes(provider);

            if (needsKey && !hasApiKey) {
                finish(provider, 'error', 'API key not configured');
                return;
            }

            if (needsUrl && !hasBaseUrl && !hasEndpoint) {
                finish(provider, 'error', 'Base URL not configured');
                return;
            }

            // All checks passed — mark as healthy
            const model = (configToTest as any).model || (configToTest as any).deployment || '';
            finish(provider, 'success', model ? `Ready (${model})` : 'Configured');

        } catch (error) {
            finish(provider, 'error', error instanceof Error ? error.message : 'Connection failed');
        }
    }, [provider]);

    /** Persist result in cache and update state (only if provider hasn't changed). */
    function finish(forProvider: string, s: HealthStatus, m: string | null) {
        healthCache.set(forProvider, { status: s, message: m, ts: Date.now() });
        // Only update state if the provider hasn't changed while we were async
        if (providerRef.current === forProvider) {
            setStatus(s);
            setMessage(m);
        }
    }

    // Check on mount or when provider changes
    useEffect(() => {
        checkHealth();
    }, [checkHealth]);

    /** Force a fresh health check (bypasses cache). */
    const recheck = useCallback(() => {
        void checkHealth(true);
    }, [checkHealth]);

    return { status, message, recheck };
}
