import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, type GetRequestHeaders } from '@kletron/shared';

type HealthStatus = 'success' | 'error' | 'loading' | 'none';

export type UseLlmHealthContext = {
    /** When set (e.g. Electron), prepended to `/api/...` paths. */
    apiOrigin?: string;
    getRequestHeaders?: GetRequestHeaders;
};

const healthCache = new Map<string, { status: HealthStatus; message: string | null; ts: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000;

function originCacheKey(apiOrigin?: string): string {
    const b = (apiOrigin ?? "").replace(/\/$/, "");
    return b || "same-origin";
}

function cacheKey(originKey: string, provider: string): string {
    return `${originKey}:${provider}`;
}

/**
 * Lightweight LLM health check hook.
 *
 * Instead of making a real LLM inference call on every page load,
 * it fetches the stored config and verifies that the provider is
 * configured (has required fields). Results are cached for 2 minutes.
 *
 * Call `recheck()` to force a fresh check (bypasses cache).
 */
export function useLlmHealth(provider: string, context?: UseLlmHealthContext) {
    const apiOrigin = context?.apiOrigin;
    const getRequestHeaders = context?.getRequestHeaders;
    const originKey = originCacheKey(apiOrigin);

    const getRequestHeadersRef = useRef(getRequestHeaders);
    getRequestHeadersRef.current = getRequestHeaders;

    const [status, setStatus] = useState<HealthStatus>(() => {
        const k = cacheKey(originKey, provider);
        const cached = provider ? healthCache.get(k) : undefined;
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.status;
        return 'none';
    });
    const [message, setMessage] = useState<string | null>(() => {
        const k = cacheKey(originKey, provider);
        const cached = provider ? healthCache.get(k) : undefined;
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.message;
        return null;
    });

    const providerRef = useRef(provider);
    providerRef.current = provider;

    const originKeyRef = useRef(originKey);
    originKeyRef.current = originKey;

    const checkHealth = useCallback(async (bypassCache = false) => {
        if (!provider) {
            setStatus('none');
            setMessage('No provider selected');
            return;
        }

        const k = cacheKey(originKeyRef.current, provider);

        if (!bypassCache) {
            const cached = healthCache.get(k);
            if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
                setStatus(cached.status);
                setMessage(cached.message);
                return;
            }
        }

        setStatus('loading');
        setMessage(null);

        const persistAndMaybeSetState = (forProvider: string, s: HealthStatus, m: string | null) => {
            const key = cacheKey(originKeyRef.current, forProvider);
            healthCache.set(key, { status: s, message: m, ts: Date.now() });
            if (providerRef.current === forProvider) {
                setStatus(s);
                setMessage(m);
            }
        };

        try {
            const configRes = await apiFetch({
                apiOrigin,
                path: "/api/llm-config",
                getRequestHeaders: () => getRequestHeadersRef.current?.() ?? Promise.resolve({}),
                method: "GET",
            });

            if (!configRes.ok) {
                persistAndMaybeSetState(provider, 'error', 'Failed to fetch LLM configuration');
                return;
            }

            const dbData = await configRes.json();
            const configToTest: Record<string, unknown> | undefined = dbData?.[provider];

            if (!configToTest) {
                persistAndMaybeSetState(provider, 'none', 'No configuration found');
                return;
            }

            const hasConfiguredFlag = typeof (configToTest as { configured?: boolean }).configured === 'boolean';
            if (hasConfiguredFlag && !(configToTest as { configured?: boolean }).configured) {
                persistAndMaybeSetState(provider, 'none', 'Not configured');
                return;
            }

            const hasApiKey = !!(configToTest as any).apiKey;
            const hasBaseUrl = !!(configToTest as any).baseUrl;
            const hasEndpoint = !!(configToTest as any).endpoint;

            const needsKey = ['azure', 'openai', 'claude', 'gemini'].includes(provider);
            const needsUrl = ['lmstudio', 'ollama', 'vllm'].includes(provider);

            if (needsKey && !hasApiKey) {
                persistAndMaybeSetState(provider, 'error', 'API key not configured');
                return;
            }

            if (needsUrl && !hasBaseUrl && !hasEndpoint) {
                persistAndMaybeSetState(provider, 'error', 'Base URL not configured');
                return;
            }

            const model = (configToTest as any).model || (configToTest as any).deployment || '';
            persistAndMaybeSetState(provider, 'success', model ? `Ready (${model})` : 'Configured');

        } catch (error) {
            persistAndMaybeSetState(
                provider,
                'error',
                error instanceof Error ? error.message : 'Connection failed'
            );
        }
    }, [provider, apiOrigin]);

    useEffect(() => {
        void checkHealth();
    }, [checkHealth]);

    const recheck = useCallback(() => {
        void checkHealth(true);
    }, [checkHealth]);

    return { status, message, recheck };
}
