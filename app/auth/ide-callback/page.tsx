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

export default function IDECallbackPage() {
    const searchParams = useSearchParams();
    const [state, setState] = useState<CallbackState>('loading');
    const [error, setError] = useState<string | null>(null);
    const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

    useEffect(() => {
        async function handleCallback() {
            try {
                // Exchange session for IDE tokens
                const response = await fetch('/api/auth/ide-auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                const data: TokenResponse = await response.json();

                if (!data.success || !data.accessToken || !data.refreshToken) {
                    throw new Error(data.error || 'Failed to get IDE tokens');
                }

                // Build deep link URL
                // Format: vscode://numezis.auth/callback?accessToken=...&refreshToken=...&expiresAt=...
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

                const ideUrl = `vscode://numezis.auth/callback?${params.toString()}`;
                setRedirectUrl(ideUrl);
                setState('success');

                // Auto-redirect to IDE after a short delay
                setTimeout(() => {
                    window.location.href = ideUrl;
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
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                {state === 'loading' && (
                    <>
                        <div className="w-12 h-12 mx-auto mb-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <h1 className="text-xl font-semibold text-white mb-2">
                            Connecting to Numezis Code...
                        </h1>
                        <p className="text-zinc-400">
                            Please wait while we authenticate your IDE.
                        </p>
                    </>
                )}

                {state === 'success' && (
                    <>
                        <div className="w-12 h-12 mx-auto mb-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-semibold text-white mb-2">
                            Authentication Successful!
                        </h1>
                        <p className="text-zinc-400 mb-6">
                            Redirecting to Numezis Code IDE...
                        </p>
                        <p className="text-sm text-zinc-500 mb-4">
                            If the IDE doesn&apos;t open automatically:
                        </p>
                        <a
                            href={redirectUrl || '#'}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open Numezis Code
                        </a>
                    </>
                )}

                {state === 'error' && (
                    <>
                        <div className="w-12 h-12 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-semibold text-white mb-2">
                            Authentication Failed
                        </h1>
                        <p className="text-zinc-400 mb-4">
                            {error || 'An error occurred during authentication.'}
                        </p>
                        <a
                            href="/auth/login?redirect=ide"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors"
                        >
                            Try Again
                        </a>
                    </>
                )}
            </div>
        </div>
    );
}
