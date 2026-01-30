'use client';
// app/auth/register/page.tsx
// Registration page - aligned with app branding
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/context/AuthContext';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { signUp } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        const result = await signUp(email, password, fullName);

        if (result.success) {
            router.push('/');
        } else {
            setError(result.error || 'Registration failed');
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
                    <h1 className="text-xl font-medium text-text-primary">Create account</h1>
                    <p className="text-sm text-text-muted mt-1">Get started with PayMe</p>
                </div>

                <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                                <p className="text-xs text-red-400">{error}</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="fullName" className="block text-xs font-medium text-text-secondary mb-1.5">
                                Full Name
                            </label>
                            <input
                                id="fullName"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full px-3 py-2 bg-bg-elevated border border-border-subtle rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-border-strong transition-colors"
                                placeholder="John Doe"
                            />
                        </div>

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

                        <div>
                            <label htmlFor="confirmPassword" className="block text-xs font-medium text-text-secondary mb-1.5">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full px-3 py-2 bg-bg-elevated border border-border-subtle rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-border-strong transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 px-4 bg-bg-elevated hover:bg-state-hover border border-border-subtle hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed text-sm text-text-primary font-medium rounded transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-text-muted border-t-text-primary rounded-full animate-spin" />
                                    <span>Creating account...</span>
                                </>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-text-muted mt-6">
                    Already have an account?{' '}
                    <Link
                        href="/auth/login"
                        className="text-text-secondary hover:text-text-primary transition-colors"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
