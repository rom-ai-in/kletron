'use client';
// app/auth/reset-password/page.tsx
// Password reset request page - aligned with app branding
import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/context/AuthContext';

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const { resetPassword } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);

        const result = await resetPassword(email);

        if (result.success) {
            setSuccess(true);
        } else {
            setError(result.error || 'Failed to send reset email');
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
                    <h1 className="text-xl font-medium text-text-primary">Reset password</h1>
                    <p className="text-sm text-text-muted mt-1">We'll send you a reset link</p>
                </div>

                <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
                    {success ? (
                        <div className="text-center py-4">
                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-sm text-text-primary mb-1">Check your inbox</p>
                            <p className="text-xs text-text-muted">
                                We've sent a password reset link to {email}
                            </p>
                        </div>
                    ) : (
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

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2 px-4 bg-bg-elevated hover:bg-state-hover border border-border-subtle hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed text-sm text-text-primary font-medium rounded transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-text-muted border-t-text-primary rounded-full animate-spin" />
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-center text-xs text-text-muted mt-6">
                    <Link
                        href="/auth/login"
                        className="text-text-secondary hover:text-text-primary transition-colors"
                    >
                        ← Back to sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
