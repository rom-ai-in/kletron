'use client';
// app/auth/register/page.tsx
// Registration page - aligned with app branding, using design system components
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@numezis/ui/context/AuthContext';
import { Input, PasswordInput, Button } from '@numezis/ui/components/design-system';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
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
            if (result.requiresConfirmation) {
                setShowConfirmation(true);
            } else {
                router.push('/');
            }
        } else {
            setError(result.error || 'Registration failed');
        }

        setLoading(false);
    };

    // Show confirmation message
    if (showConfirmation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-app px-4">
                <div className="w-full max-w-sm text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-success-bg border border-status-success-border mb-6">
                        <svg className="w-8 h-8 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-medium text-text-primary mb-2">Check your email</h1>
                    <p className="text-sm text-text-muted mb-6">
                        We sent a confirmation link to<br />
                        <span className="text-text-secondary font-medium">{email}</span>
                    </p>
                    <p className="text-xs text-text-muted mb-6">
                        Click the link in the email to activate your account.
                    </p>
                    <a
                        href="/auth/login"
                        className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                        Back to login
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-app px-4">
            <div className="w-full max-w-sm">
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-bg-surface border border-border-subtle mb-4 hover:bg-state-hover hover:border-border-strong transition-all">
                        <span className="text-xl">🧠</span>
                    </Link>
                    <h1 className="text-xl font-medium text-text-primary">Create account</h1>
                    <p className="text-sm text-text-muted mt-1">Get started with Numezis Code</p>
                </div>

                <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-status-error-bg border border-status-error-border rounded px-3 py-2">
                                <p className="text-xs text-status-error-text">{error}</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="fullName" className="block text-xs font-medium text-text-secondary mb-1.5">
                                Full Name
                            </label>
                            <Input
                                id="fullName"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="John Doe"
                                fullWidth
                            />
                        </div>

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

                        <div>
                            <label htmlFor="confirmPassword" className="block text-xs font-medium text-text-secondary mb-1.5">
                                Confirm Password
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
                            {loading ? 'Creating account...' : 'Create Account'}
                        </Button>
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
