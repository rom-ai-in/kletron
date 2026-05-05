import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, type GetRequestHeaders } from '@kletron/shared';

type HealthStatus = 'success' | 'error' | 'loading' | 'none';

export type UseLlmHealthContext = {
    /** When set (e.g. Electron), prepended to `/api/...` paths. */
    apiOrigin?: string;
    getRequestHeaders?: GetRequestHeaders;
};

const healthCache = new Map<string, { status: HealthStatus; message: string | null; ts: number }>();
/** Short TTL so the status bar reflects real connectivity; periodic refresh also runs while mounted. */
const CACHE_TTL_MS = 25 * 1000;
const REFRESH_INTERVAL_MS = 35 * 1000;

function originCacheKey(apiOrigin?: string): string {
    const b = (apiOrigin ?? "").replace(/\/$/, "");
    return b || "same-origin";
}

function cacheKey(originKey: string, provider: string): string {
    return `${originKey}:${provider}`;
}

type LiveHealthJson = {
    status?: 'success' | 'error' | 'none';
    message?: string | null;
    error?: string;
};

/**
 * Live LLM reachability (server-side probe: lists/models endpoints, no chat completion).
 * Cached briefly; refetches on an interval and when the tab becomes visible again.
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
            const liveRes = await apiFetch({
                apiOrigin,
                path: "/api/llm-config/live-health",
                getRequestHeaders: () => getRequestHeadersRef.current?.() ?? Promise.resolve({}),
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider }),
            });

            if (liveRes.status === 401) {
                persistAndMaybeSetState(provider, 'error', 'Sign in required');
                return;
            }

            const live = (await liveRes.json()) as LiveHealthJson;
            const msg = live.message ?? live.error ?? null;

            if (live.status === 'success') {
                persistAndMaybeSetState(provider, 'success', msg || 'Reachable');
            } else if (live.status === 'none') {
                persistAndMaybeSetState(provider, 'none', msg || 'Not configured');
            } else {
                persistAndMaybeSetState(provider, 'error', msg || 'Unreachable');
            }
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

    useEffect(() => {
        const id = window.setInterval(() => {
            void checkHealth(true);
        }, REFRESH_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [checkHealth]);

    useEffect(() => {
        const onVis = () => {
            if (document.visibilityState === 'visible') {
                void checkHealth(true);
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [checkHealth]);

    const recheck = useCallback(() => {
        void checkHealth(true);
    }, [checkHealth]);

    return { status, message, recheck };
}
