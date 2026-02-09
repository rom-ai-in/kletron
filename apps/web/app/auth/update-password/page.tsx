'use client';
// app/auth/update-password/page.tsx
// Update password page - aligned with app branding, using design system components
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@numezis/ui/context/AuthContext';
import { PasswordInput, Button } from '@numezis/ui/components/design-system';

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { updatePassword, session } = useAuth();

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

        const result = await updatePassword(password);

        if (result.success) {
            setSuccess(true);
            setTimeout(() => {
                router.push('/');
            }, 2000);
        } else {
            setError(result.error || 'Failed to update password');
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
                    <h1 className="text-xl font-medium text-text-primary">Set new password</h1>
                    <p className="text-sm text-text-muted mt-1">Choose a strong password</p>
                </div>

                <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
                    {success ? (
                        <div className="text-center py-4">
                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-status-success-bg border border-status-success-border mb-4">
                                <svg className="w-5 h-5 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-sm text-text-primary mb-1">Password updated</p>
                            <p className="text-xs text-text-muted">Redirecting you to the app...</p>
                        </div>
                    ) : !session ? (
                        <div className="text-center py-4">
                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-status-warning-bg border border-status-warning-border mb-4">
                                <svg className="w-5 h-5 text-status-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <p className="text-sm text-text-primary mb-1">Invalid reset link</p>
                            <p className="text-xs text-text-muted mb-4">This link has expired or is invalid</p>
                            <Link
                                href="/auth/reset-password"
                                className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                            >
                                Request a new reset link →
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-status-error-bg border border-status-error-border rounded px-3 py-2">
                                    <p className="text-xs text-status-error-text">{error}</p>
                                </div>
                            )}

                            <div>
                                <label htmlFor="password" className="block text-xs font-medium text-text-secondary mb-1.5">
                                    New Password
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

                            <div>
                                <label htmlFor="confirmPassword" className="block text-xs font-medium text-text-secondary mb-1.5">
                                    Confirm New Password
                                </label>
                                <PasswordInput
                                    id="confirmPassword"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    fullWidth
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                loading={loading}
                                fullWidth
                            >
                                {loading ? 'Updating...' : 'Update Password'}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
