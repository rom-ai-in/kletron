'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@kletron/ui/context/AuthContext';
import { Input, PasswordInput, Button, Card, CardHeader, CardContent } from '@kletron/ui/components/design-system';
import { Copy, Key, Shield, User, LogOut, Plus, X } from 'lucide-react';
interface ApiTokenInfo {
    id: string;
    label: string | null;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
}

export default function AccountPage() {
    const router = useRouter();
    const { user, profile, updateProfile, updatePassword, signOut } = useAuth();

    const [fullName, setFullName] = useState('');
    const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [profileError, setProfileError] = useState('');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [passwordError, setPasswordError] = useState('');

    const [tokenLabel, setTokenLabel] = useState('Kletron IDE');
    const [tokens, setTokens] = useState<ApiTokenInfo[]>([]);
    const [tokensLoading, setTokensLoading] = useState(false);
    const [tokenError, setTokenError] = useState('');
    const [creatingToken, setCreatingToken] = useState(false);
    const [newToken, setNewToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (profile?.full_name) {
            setFullName(profile.full_name);
        }
    }, [profile]);

    const fetchTokens = async () => {
        setTokensLoading(true);
        setTokenError('');
        try {
            const res = await fetch('/api/auth/api-tokens', { cache: 'no-store' });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || 'Failed to fetch tokens');
            }
            const data = await res.json();
            setTokens(data.tokens || []);
        } catch (err) {
            setTokenError(err instanceof Error ? err.message : 'Error loading tokens');
        } finally {
            setTokensLoading(false);
        }
    };

    useEffect(() => {
        void fetchTokens();
    }, []);

    const handleProfileSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setProfileStatus('saving');
        setProfileError('');

        const result = await updateProfile({ fullName });
        if (result.success) {
            setProfileStatus('success');
            setTimeout(() => setProfileStatus('idle'), 2000);
        } else {
            setProfileStatus('error');
            setProfileError(result.error || 'Unable to update profile');
        }
    };

    const handlePasswordSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setPasswordStatus('saving');
        setPasswordError('');

        if (newPassword.length < 6) {
            setPasswordStatus('error');
            setPasswordError('Password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordStatus('error');
            setPasswordError('Passwords do not match');
            return;
        }

        const result = await updatePassword(newPassword);
        if (result.success) {
            setPasswordStatus('success');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordStatus('idle'), 2000);
        } else {
            setPasswordStatus('error');
            setPasswordError(result.error || 'Unable to update password');
        }
    };

    const handleCreateToken = async () => {
        setCreatingToken(true);
        setTokenError('');
        setNewToken(null);
        try {
            const res = await fetch('/api/auth/api-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: tokenLabel }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || 'Failed to create token');
            }
            const data = await res.json();
            setNewToken(data.token || null);
            await fetchTokens();
        } catch (err) {
            setTokenError(err instanceof Error ? err.message : 'Error creating token');
        } finally {
            setCreatingToken(false);
        }
    };

    const handleRevokeToken = async (tokenId: string) => {
        setTokenError('');
        try {
            const res = await fetch(`/api/auth/api-tokens/${tokenId}`, { method: 'DELETE' });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || 'Failed to revoke token');
            }
            await fetchTokens();
        } catch (err) {
            setTokenError(err instanceof Error ? err.message : 'Error revoking token');
        }
    };

    const handleCopyToken = async () => {
        if (!newToken) return;
        await navigator.clipboard.writeText(newToken);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSignOut = async () => {
        await signOut();
        router.push('/auth/login');
    };

    const tokenHint = useMemo(() => {
        if (!newToken) return null;
        return (
            <div className="mt-4 rounded-lg border border-status-success-border bg-status-success-bg p-4">
                <p className="text-xs font-semibold text-status-success-text">Token generated (copy it now)</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="flex-1 rounded bg-bg-elevated px-3 py-2 text-xs text-text-primary break-all">
                        {newToken}
                    </code>
                    <Button
                        type="button"
                        onClick={handleCopyToken}
                        variant="secondary"
                        size="sm"
                    >
                        {copied ? 'Copied' : 'Copy'}
                    </Button>
                </div>
                <p className="mt-2 text-[11px] text-status-success-text/80">
                    This token will not be shown again. Paste it in the Kletron IDE.
                </p>
            </div>
        );
    }, [newToken, copied]);

    return (
        <div className="h-full overflow-y-auto bg-bg-app">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8 pb-16">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">My Account</h1>
                    <p className="text-sm text-text-muted">Manage your Kletron account and extension connection.</p>
                </div>

                {/* Profile Section */}
                <section className="rounded-lg border border-border-subtle bg-bg-surface p-6">
                    <h2 className="text-sm font-semibold text-text-primary">Profile</h2>
                    <p className="mt-1 text-xs text-text-muted">Update your main information.</p>
                    <form onSubmit={handleProfileSubmit} className="mt-4 space-y-4">
                        {profileStatus === 'error' && (
                            <div className="rounded border border-status-error-border bg-status-error-bg px-3 py-2">
                                <p className="text-xs text-status-error-text">{profileError}</p>
                            </div>
                        )}
                        {profileStatus === 'success' && (
                            <div className="rounded border border-status-success-border bg-status-success-bg px-3 py-2">
                                <p className="text-xs text-status-success-text">Profile updated</p>
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
                                fullWidth
                                placeholder="Your name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
                            <div className="rounded border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-muted">
                                {user?.email || '—'}
                            </div>
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            loading={profileStatus === 'saving'}
                        >
                            {profileStatus === 'saving' ? 'Saving…' : 'Save'}
                        </Button>
                    </form>
                </section>

                {/* Security Section */}
                <section className="rounded-lg border border-border-subtle bg-bg-surface p-6">
                    <h2 className="text-sm font-semibold text-text-primary">Security</h2>
                    <p className="mt-1 text-xs text-text-muted">Change your password.</p>
                    <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
                        {passwordStatus === 'error' && (
                            <div className="rounded border border-status-error-border bg-status-error-bg px-3 py-2">
                                <p className="text-xs text-status-error-text">{passwordError}</p>
                            </div>
                        )}
                        {passwordStatus === 'success' && (
                            <div className="rounded border border-status-success-border bg-status-success-bg px-3 py-2">
                                <p className="text-xs text-status-success-text">Password updated</p>
                            </div>
                        )}
                        <div>
                            <label htmlFor="newPassword" className="block text-xs font-medium text-text-secondary mb-1.5">
                                New Password
                            </label>
                            <PasswordInput
                                id="newPassword"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                fullWidth
                                placeholder="••••••••"
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
                                fullWidth
                                placeholder="••••••••"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            loading={passwordStatus === 'saving'}
                        >
                            {passwordStatus === 'saving' ? 'Updating…' : 'Update Password'}
                        </Button>
                    </form>
                </section>

                {/* Kletron IDE Section */}
                <section className="rounded-lg border border-border-subtle bg-bg-surface p-6">
                    <h2 className="text-sm font-semibold text-text-primary">Kletron IDE</h2>
                    <p className="mt-1 text-xs text-text-muted">
                        Generate a token to sync your Kletron account with the desktop IDE.
                    </p>

                    <div className="mt-4 space-y-3 text-xs text-text-secondary">
                        <p>1. Generate a token below.</p>
                        <p>2. In Kletron, run <code className="rounded bg-bg-elevated px-1.5 py-0.5">kletron.connectBackend</code> and paste the token.</p>
                        <p>3. The IDE will use this token to connect to your account.</p>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Input
                            type="text"
                            value={tokenLabel}
                            onChange={(e) => setTokenLabel(e.target.value)}
                            fullWidth
                            placeholder="Token name"
                        />
                        <Button
                            type="button"
                            onClick={handleCreateToken}
                            variant="secondary"
                            size="sm"
                            loading={creatingToken}
                        >
                            {creatingToken ? 'Creating…' : 'Create Token'}
                        </Button>
                    </div>

                    {tokenError && (
                        <div className="mt-4 rounded border border-status-error-border bg-status-error-bg px-3 py-2">
                            <p className="text-xs text-status-error-text">{tokenError}</p>
                        </div>
                    )}

                    {tokenHint}

                    <div className="mt-6">
                        <h3 className="text-xs font-semibold text-text-secondary">Existing Tokens</h3>
                        <div className="mt-3 space-y-2">
                            {tokensLoading ? (
                                <p className="text-xs text-text-muted">Loading…</p>
                            ) : tokens.length === 0 ? (
                                <p className="text-xs text-text-muted">No active tokens yet.</p>
                            ) : (
                                tokens.map((token) => (
                                    <div
                                        key={token.id}
                                        className="flex flex-col gap-2 rounded border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div>
                                            <p className="text-text-primary">{token.label || 'Unnamed token'}</p>
                                            <p className="text-[11px] text-text-muted">
                                                Created on {new Date(token.created_at).toLocaleDateString('en-US')} —
                                                {token.last_used_at ? ` last used ${new Date(token.last_used_at).toLocaleDateString('en-US')}` : ' never used'}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={() => handleRevokeToken(token.id)}
                                            variant="secondary"
                                            size="sm"
                                        >
                                            Revoke
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>

                {/* Sign Out Section */}
                <section className="rounded-lg border border-border-subtle bg-bg-surface p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-text-primary">Sign Out</h2>
                            <p className="mt-1 text-xs text-text-muted">End your session on this device.</p>
                        </div>
                        <Button
                            type="button"
                            onClick={handleSignOut}
                            variant="secondary"
                            size="sm"
                        >
                            Sign Out
                        </Button>
                    </div>
                </section>
            </div>
        </div>
    );
}
