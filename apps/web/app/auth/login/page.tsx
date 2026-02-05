'use client';
// app/auth/login/page.tsx
// Login page - aligned with app branding
import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@numezis/ui/context/AuthContext';
import { getRememberMePreference } from '@numezis/ui/lib/supabase/supabaseClient';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { signIn, resendConfirmation } = useAuth();
    const isExtensionFlow = searchParams?.get('source') === 'extension';
    const redirect = searchParams?.get('redirect');
    const isIDEFlow = redirect === 'ide';
    const isDeviceFlow = redirect === 'ide-device' || redirect === 'device';

    const isEmailNotConfirmed = error.toLowerCase().includes('email not confirmed');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setResendSuccess(false);
        setLoading(true);

        const result = await signIn(email, password, rememberMe);

        if (result.success) {
            // Route based on flow type
            if (isIDEFlow) {
                // Preserve deviceSessionId + loopback params for the callback page
                const deviceSessionId = searchParams?.get('deviceSessionId');
                const redirectUri = searchParams?.get('redirectUri');
                const codeChallenge = searchParams?.get('code_challenge');
                const params = new URLSearchParams();

                if (deviceSessionId) params.set('deviceSessionId', deviceSessionId);
                if (redirectUri) params.set('redirectUri', redirectUri);
                if (codeChallenge) params.set('code_challenge', codeChallenge);

                const callbackUrl = params.toString()
                    ? `/auth/ide-callback?${params.toString()}`
                    : '/auth/ide-callback';
                router.push(callbackUrl);
            } else if (isDeviceFlow) {
                const userCode = searchParams?.get('userCode');
                const deviceUrl = userCode
                    ? `/auth/ide-device?userCode=${encodeURIComponent(userCode)}`
                    : '/auth/ide-device';
                router.push(deviceUrl);
            } else if (isExtensionFlow) {
                router.push('/auth/extension-success');
            } else {
                router.push('/');
            }
        } else {
            setError(result.error || 'Sign in failed');
        }

        setLoading(false);
    };

    const handleResendConfirmation = async () => {
        if (!email) {
            setError('Please enter your email address first');
            return;
        }
        setResendLoading(true);
        setResendSuccess(false);

        const result = await resendConfirmation(email);

        if (result.success) {
            setResendSuccess(true);
            setError('');
        } else {
            setError(result.error || 'Failed to resend confirmation email');
        }

        setResendLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-app px-4">
            <div className="w-full max-w-sm">
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-bg-surface border border-border-subtle mb-4 hover:bg-state-hover hover:border-border-strong transition-all">
                        <span className="text-xl">🧠</span>
                    </Link>
                    <h1 className="text-xl font-medium text-text-primary">Welcome back</h1>
                    <p className="text-sm text-text-muted mt-1">
                        {isIDEFlow ? 'Sign in to connect Numezis Code' : isDeviceFlow ? 'Sign in to confirm your device code' : isExtensionFlow ? 'Sign in to connect VS Code' : 'Sign in to your account'}
                    </p>
                </div>

                <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                                <p className="text-xs text-red-400">{error}</p>
                                {isEmailNotConfirmed && (
                                    <button
                                        type="button"
                                        onClick={handleResendConfirmation}
                                        disabled={resendLoading}
                                        className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline disabled:opacity-50"
                                    >
                                        {resendLoading ? 'Sending...' : 'Resend confirmation email'}
                                    </button>
                                )}
                            </div>
                        )}

                        {resendSuccess && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded px-3 py-2">
                                <p className="text-xs text-green-400">Confirmation email sent! Check your inbox.</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-xs font-medium text-text-secondary mb-1.5">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 bg-bg-elevated border border-border-subtle rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-border-strong transition-colors"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-xs font-medium text-text-secondary mb-1.5">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-3 py-2 bg-bg-elevated border border-border-subtle rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-border-strong transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-border-subtle bg-bg-elevated text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="text-xs text-text-secondary">Remember me</span>
                            </label>
                            <Link
                                href="/auth/reset-password"
                                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 px-4 bg-bg-elevated hover:bg-state-hover border border-border-subtle hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed text-sm text-text-primary font-medium rounded transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-text-muted border-t-text-primary rounded-full animate-spin" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-text-muted mt-6">
                    Don't have an account?{' '}
                    <Link
                        href="/auth/register"
                        className="text-text-secondary hover:text-text-primary transition-colors"
                    >
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
}
