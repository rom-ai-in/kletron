'use client';
// app/auth/ide-device/page.tsx
// Device code verification for IDE login

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@kletron/ui/context/AuthContext';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function IdeDeviceClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();
    const [userCode, setUserCode] = useState('');
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams?.get('userCode');
        if (code) {
            setUserCode(code.toUpperCase());
        }
    }, [searchParams]);

    const completeCode = async (trimmed: string) => {
        setStatus('submitting');
        try {
            const response = await fetch('/api/auth/ide-device/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userCode: trimmed }),
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Invalid code');
            }

            setStatus('success');
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to complete device sign-in');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmed = userCode.trim().toUpperCase();
        if (!trimmed) {
            setError('Enter the code shown in your IDE.');
            return;
        }

        if (loading) {
            return;
        }

        if (!user) {
            router.push(`/auth/login?redirect=ide-device&userCode=${encodeURIComponent(trimmed)}`);
            return;
        }

        await completeCode(trimmed);
    };

    useEffect(() => {
        if (loading || !user || status !== 'idle') return;
        const trimmed = userCode.trim().toUpperCase();
        if (trimmed) {
            void completeCode(trimmed);
        }
    }, [loading, user, status, userCode]);

    return (
        <div className="min-h-screen bg-bg-app flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-bg-surface border border-border-subtle rounded-lg p-8">
                <div className="text-center mb-6">
                    <div className="text-3xl mb-2">🧠</div>
                    <h1 className="text-xl font-semibold text-text-primary">Connect Kletron</h1>
                    <p className="text-sm text-text-muted mt-2">
                        Enter the code shown in your IDE to finish sign-in.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            Device Code
                        </label>
                        <input
                            value={userCode}
                            onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                            placeholder="ABCD-EFGH"
                            className="w-full px-3 py-2 bg-bg-elevated border border-border-subtle rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-border-strong transition-colors tracking-[0.18em] text-center uppercase"
                        />
                    </div>

                    {error && (
                        <div className="bg-status-error-bg border border-status-error-border rounded px-3 py-2 text-xs text-status-error-text">
                            {error}
                        </div>
                    )}

                    {status === 'success' ? (
                        <div className="bg-status-success-bg border border-status-success-border rounded px-3 py-2 text-xs text-status-success-text">
                            Success! You can return to Kletron.
                        </div>
                    ) : (
                        <button
                            type="submit"
                            disabled={status === 'submitting'}
                            className="w-full py-2 px-4 bg-bg-elevated hover:bg-state-hover border border-border-subtle hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed text-sm text-text-primary font-medium rounded transition-all"
                        >
                            {user ? 'Complete Sign-In' : 'Sign In to Continue'}
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
