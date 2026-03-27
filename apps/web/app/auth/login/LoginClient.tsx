'use client';
// app/auth/login/page.tsx
// Login page - aligned with app branding, using design system components
import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@kletron/ui/context/AuthContext';
import { getRememberMePreference } from '@kletron/ui/lib/supabase/supabaseClient';
import { Input, PasswordInput, Button, Checkbox } from '@kletron/ui/components/design-system';

export default function LoginClient() {
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
                        {isIDEFlow ? 'Sign in to connect Kletron' : isDeviceFlow ? 'Sign in to confirm your device code' : isExtensionFlow ? 'Sign in to connect VS Code' : 'Sign in to your account'}
                    </p>
                </div>

                <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-status-error-bg border border-status-error-border rounded px-3 py-2">
                                <p className="text-xs text-status-error-text">{error}</p>
                                {isEmailNotConfirmed && (
                                    <button
                                        type="button"
                                        onClick={handleResendConfirmation}
                                        disabled={resendLoading}
                                        className="mt-2 text-xs text-status-info-text hover:text-status-info-text underline disabled:opacity-50"
                                    >
                                        {resendLoading ? 'Sending...' : 'Resend confirmation email'}
                                    </button>
                                )}
                            </div>
                        )}

                        {resendSuccess && (
                            <div className="bg-status-success-bg border border-status-success-border rounded px-3 py-2">
                                <p className="text-xs text-status-success-text">Confirmation email sent! Check your inbox.</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-xs font-medium text-text-secondary mb-1.5">
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                fullWidth
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-xs font-medium text-text-secondary mb-1.5">
                                Password
                            </label>
                            <PasswordInput
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                fullWidth
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Checkbox
                                checked={rememberMe}
                                onChange={setRememberMe}
                                size="sm"
                                label="Remember me"
                            />
                            <Link
                                href="/auth/reset-password"
                                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            loading={loading}
                            fullWidth
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Button>
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
