'use client';
// app/auth/login/page.tsx
// Login page - aligned with app branding
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/context/AuthContext';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { signIn } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await signIn(email, password, rememberMe);

        if (result.success) {
            router.push('/');
        } else {
            setError(result.error || 'Sign in failed');
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-app px-4">
            <div className="w-full max-w-sm">
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-bg-surface border border-border-subtle mb-4">
                        <span className="text-xl">🧠</span>
                    </div>
                    <h1 className="text-xl font-medium text-text-primary">Welcome back</h1>
                    <p className="text-sm text-text-muted mt-1">Sign in to your account</p>
                </div>

                <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                                <p className="text-xs text-red-400">{error}</p>
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
                                <span className="text-xs text-text-secondary">Se souvenir de moi</span>
                            </label>
                            <Link
                                href="/auth/reset-password"
                                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                            >
                                Mot de passe oublié ?
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
