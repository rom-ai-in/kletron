'use client';
// app/auth/ide-callback/page.tsx
// IDE Authentication Callback Page
// Handles the redirect after web login and sends tokens to the IDE via deep link

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type CallbackState = 'loading' | 'success' | 'error';

interface TokenResponse {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    user?: {
        id: string;
        email: string;
        fullName: string | null;
    };
    error?: string;
}

export default function IdeCallbackClient() {
    const searchParams = useSearchParams();
    const [state, setState] = useState<CallbackState>('loading');
    const [error, setError] = useState<string | null>(null);
    const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
    const [loopbackUrl, setLoopbackUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function handleCallback() {
            try {
                console.log('[IDE Callback] Starting callback handling...');

                // Get device session ID from URL (passed from IDE when opening login page)
                const deviceSessionId = searchParams?.get('deviceSessionId');
                const redirectUri = searchParams?.get('redirectUri');
                console.log('[IDE Callback] Device session ID:', deviceSessionId);

                // Exchange session for IDE tokens
                const response = await fetch('/api/auth/ide-auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                const data: TokenResponse = await response.json();
                console.log('[IDE Callback] Token response:', {
                    success: data.success,
                    hasAccessToken: !!data.accessToken,
                    hasRefreshToken: !!data.refreshToken,
                    expiresAt: data.expiresAt,
                    userEmail: data.user?.email,
                    error: data.error
                });

                if (!data.success || !data.accessToken || !data.refreshToken) {
                    throw new Error(data.error || 'Failed to get IDE tokens');
                }

                // If we have a device session ID, store the session for polling
                // This is the fallback for when deep links don't work
                if (deviceSessionId) {
                    console.log('[IDE Callback] Storing session for device polling...');
                    try {
                        await fetch('/api/auth/ide-session', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                deviceSessionId,
                                userId: data.user?.id,
                                email: data.user?.email,
                                fullName: data.user?.fullName,
                            }),
                        });
                        console.log('[IDE Callback] Session stored, IDE can poll for tokens');
                    } catch (err) {
                        console.warn('[IDE Callback] Failed to store session for polling:', err);
                    }
                }

                // Build deep link URL
                // Format: numezis-code://numezis.auth/callback?accessToken=...&refreshToken=...&expiresAt=...
                const params = new URLSearchParams({
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    expiresAt: String(data.expiresAt),
                    userId: data.user?.id || '',
                    email: data.user?.email || '',
                    fullName: data.user?.fullName || '',
                });

                // Check for state parameter (CSRF protection)
                const stateParam = searchParams?.get('state');
                if (stateParam) {
                    params.set('state', stateParam);
                }

                const ideUrl = `numezis-code://numezis.auth/callback?${params.toString()}`;
                console.log('[IDE Callback] Deep link URL generated:', ideUrl.substring(0, 100) + '...');
                console.log('[IDE Callback] Full URL length:', ideUrl.length);

                setRedirectUrl(ideUrl);

                // Prepare loopback redirect (localhost only)
                let resolvedLoopbackUrl: string | null = null;
                if (redirectUri) {
                    try {
                        const parsed = new URL(redirectUri);
                        const isLocalhost =
                            parsed.hostname === 'localhost' ||
                            parsed.hostname === '127.0.0.1' ||
                            parsed.hostname === '[::1]';
                        if (parsed.protocol === 'http:' && isLocalhost) {
                            parsed.searchParams.set('deviceSessionId', deviceSessionId || '');
                            parsed.searchParams.set('status', 'success');
                            resolvedLoopbackUrl = parsed.toString();
                            setLoopbackUrl(resolvedLoopbackUrl);
                        }
                    } catch (err) {
                        console.warn('[IDE Callback] Invalid redirectUri:', err);
                    }
                }
                setState('success');

                // Auto-redirect to IDE after a short delay
                console.log('[IDE Callback] Will redirect in 1 second...');
                setTimeout(() => {
                    console.log('[IDE Callback] Redirecting now via window.location.href');
                    if (resolvedLoopbackUrl) {
                        window.location.href = resolvedLoopbackUrl;
                    } else {
                        window.location.href = ideUrl;
                    }
                }, 1000);

            } catch (err) {
                console.error('[IDE Callback] Error:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
                setState('error');
            }
        }

        handleCallback();
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-bg-app flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-bg-surface border border-border-subtle rounded-lg p-8 text-center">
                {state === 'loading' && (
                    <>
                        <div className="w-12 h-12 mx-auto mb-4 border-2 border-status-success-border border-t-transparent rounded-full animate-spin" />
                        <h1 className="text-xl font-semibold text-text-primary mb-2">
                            Connecting to Numezis Code...
                        </h1>
                        <p className="text-text-muted text-sm">
                            Please wait while we authenticate your IDE.
                        </p>
                    </>
                )}

                {state === 'success' && (
                    <>
                        <div className="w-12 h-12 mx-auto mb-4 bg-status-success-bg rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-semibold text-text-primary mb-2">
                            Authentication Successful!
                        </h1>
                        <p className="text-text-muted text-sm mb-6">
                            Redirecting to Numezis Code IDE...
                        </p>
                        <p className="text-xs text-text-muted mb-4">
                            If the IDE doesn&apos;t open automatically:
                        </p>
                        <a
                            href={redirectUrl || '#'}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-text-primary text-bg-app text-sm font-medium hover:bg-text-secondary transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open Numezis Code
                        </a>
                        {loopbackUrl && (
                            <a
                                href={loopbackUrl}
                                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-bg-elevated hover:bg-state-hover border border-border-subtle text-sm font-medium text-text-primary transition-colors"
                            >
                                Finish In App
                            </a>
                        )}
                        <button
                            onClick={async () => {
                                if (!redirectUrl) return;
                                await navigator.clipboard.writeText(redirectUrl);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-bg-elevated hover:bg-state-hover border border-border-subtle text-sm font-medium text-text-primary transition-colors"
                        >
                            {copied ? 'Copied!' : 'Copy Sign-In Link'}
                        </button>
                    </>
                )}

                {state === 'error' && (
                    <>
                        <div className="w-12 h-12 mx-auto mb-4 bg-status-error-bg rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-status-error-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-semibold text-text-primary mb-2">
                            Authentication Failed
                        </h1>
                        <p className="text-text-muted text-sm mb-4">
                            {error || 'An error occurred during authentication.'}
                        </p>
                        <a
                            href="/auth/login?redirect=ide"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-bg-elevated hover:bg-state-hover border border-border-subtle text-sm font-medium text-text-primary transition-colors"
                        >
                            Try Again
                        </a>
                    </>
                )}
            </div>
        </div>
    );
}
