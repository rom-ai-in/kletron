'use client';
// app/auth/reset-password/page.tsx
// Password reset request page - aligned with app branding, using design system components
import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@kletron/ui/context/AuthContext';
import { Input, Button } from '@kletron/ui/components/design-system';

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
                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-status-success-bg border border-status-success-border mb-4">
                                <svg className="w-5 h-5 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                <div className="bg-status-error-bg border border-status-error-border rounded px-3 py-2">
                                    <p className="text-xs text-status-error-text">{error}</p>
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

                            <Button
                                type="submit"
                                disabled={loading}
                                loading={loading}
                                fullWidth
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </Button>
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
