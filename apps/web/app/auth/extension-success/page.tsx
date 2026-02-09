'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@numezis/ui/context/AuthContext';

export default function ExtensionSuccessPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const generateToken = async () => {
            if (authLoading) {
                return;
            }

            if (!user) {
                router.push('/auth/login?source=extension');
                return;
            }

            try {
                const res = await fetch('/api/auth/api-tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ label: `VS Code Extension (${new Date().toLocaleDateString()})` }),
                });

                if (!res.ok) {
                    throw new Error('Failed to generate token');
                }

                const data = await res.json();
                setToken(data.token);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error generating token');
            } finally {
                setLoading(false);
            }
        };

        generateToken();
    }, [user, authLoading, router]);

    const handleCopy = async () => {
        if (!token) return;
        await navigator.clipboard.writeText(token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-app">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-status-success-border border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-text-muted">Checking session...</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-app">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-status-success-border border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-text-muted">Generating token...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-app px-4">
                <div className="w-full max-w-sm text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-error-bg border border-status-error-border mb-6">
                        <svg className="w-8 h-8 text-status-error-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-medium text-text-primary mb-2">Something went wrong</h1>
                    <p className="text-sm text-text-muted mb-6">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-app px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-success-bg border border-status-success-border mb-6">
                        <svg className="w-8 h-8 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-medium text-text-primary mb-2">Almost there!</h1>
                    <p className="text-sm text-text-muted">
                        Copy this token and paste it in VS Code when prompted.
                    </p>
                </div>

                <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
                    <label className="block text-xs font-medium text-text-secondary mb-2">
                        Your Extension Token
                    </label>
                    <div className="relative">
                        <code className="block w-full rounded border border-border-subtle bg-bg-elevated px-3 py-3 text-xs text-text-primary break-all font-mono">
                            {token}
                        </code>
                    </div>
                    <button
                        onClick={handleCopy}
                        className="mt-4 w-full py-2.5 px-4 bg-status-success hover:bg-status-success text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
                    >
                        {copied ? (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy Token
                            </>
                        )}
                    </button>

                    <div className="mt-6 pt-4 border-t border-border-subtle">
                        <p className="text-xs text-text-muted text-center">
                            This token will only be shown once.
                            <br />
                            You can revoke it anytime from your{' '}
                            <a href="/account" className="text-text-secondary hover:text-text-primary transition-colors">
                                account settings
                            </a>.
                        </p>
                    </div>
                </div>

                <p className="text-center text-xs text-text-muted mt-6">
                    You can close this page after copying the token.
                </p>
            </div>
        </div>
    );
}
