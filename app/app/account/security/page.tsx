'use client';

import { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
    KeyRound,
    Smartphone,
    Shield,
    Eye,
    EyeOff,
    AlertTriangle,
    Globe,
    Clock,
    LogOut,
    Check
} from 'lucide-react';

interface Session {
    id: string;
    device: string;
    browser: string;
    location: string;
    lastActive: string;
    current: boolean;
}

export default function SecurityPage() {
    const { updatePassword } = useAuth();

    const [showPassword, setShowPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [passwordError, setPasswordError] = useState('');

    const [sessions] = useState<Session[]>([
        {
            id: '1',
            device: 'MacBook Pro',
            browser: 'Chrome 120',
            location: 'Geneva, Switzerland',
            lastActive: 'Now',
            current: true,
        },
        {
            id: '2',
            device: 'VS Code Extension',
            browser: 'Extension',
            location: 'Geneva, Switzerland',
            lastActive: '2 hours ago',
            current: false,
        },
    ]);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordStatus('saving');
        setPasswordError('');

        if (newPassword.length < 8) {
            setPasswordStatus('error');
            setPasswordError('Password must be at least 8 characters');
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
            setTimeout(() => setPasswordStatus('idle'), 3000);
        } else {
            setPasswordStatus('error');
            setPasswordError(result.error || 'Failed to update password');
        }
    };

    const handleRevokeSession = async (sessionId: string) => {
        // TODO: Implement session revocation API
        console.log('Revoking session:', sessionId);
    };

    const handleRevokeAllSessions = async () => {
        // TODO: Implement revoke all sessions API
        console.log('Revoking all sessions');
    };

    return (
        <div className="space-y-6">
            {/* Password Section */}
            <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center">
                        <KeyRound className="w-5 h-5 text-text-muted" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-text-primary">Change Password</h2>
                        <p className="text-xs text-text-muted">Update your account password</p>
                    </div>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    {passwordStatus === 'error' && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                            <p className="text-xs text-red-400">{passwordError}</p>
                        </div>
                    )}

                    {passwordStatus === 'success' && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                            <p className="text-xs text-emerald-400">Password updated successfully</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            New Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-3 py-2.5 pr-10 rounded-md border border-border-subtle bg-bg-elevated text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            Confirm New Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-md border border-border-subtle bg-bg-elevated text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40"
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="text-[11px] text-text-muted space-y-1">
                        <p>Password requirements:</p>
                        <ul className="list-disc list-inside space-y-0.5 pl-2">
                            <li>At least 8 characters long</li>
                            <li>Mix of uppercase and lowercase letters recommended</li>
                            <li>Include numbers and special characters for stronger security</li>
                        </ul>
                    </div>

                    <button
                        type="submit"
                        disabled={passwordStatus === 'saving' || !newPassword || !confirmPassword}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-text-primary text-bg-app hover:bg-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {passwordStatus === 'saving' ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>

            {/* Two-Factor Authentication */}
            <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-text-muted" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-text-primary">Two-Factor Authentication</h3>
                            <p className="text-xs text-text-muted">Add an extra layer of security</p>
                        </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Coming Soon
                    </span>
                </div>

                <p className="mt-4 text-sm text-text-secondary">
                    Two-factor authentication adds an extra layer of security by requiring a code from your
                    authenticator app in addition to your password.
                </p>
            </div>

            {/* Active Sessions */}
            <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center">
                            <Shield className="w-5 h-5 text-text-muted" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-text-primary">Active Sessions</h3>
                            <p className="text-xs text-text-muted">Devices where you're logged in</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRevokeAllSessions}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                        Sign out all devices
                    </button>
                </div>

                <div className="space-y-3">
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            className="flex items-center justify-between p-4 rounded-md bg-bg-elevated border border-border-subtle"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-md bg-bg-surface border border-border-subtle flex items-center justify-center">
                                    {session.browser === 'Extension' ? (
                                        <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352z" />
                                        </svg>
                                    ) : (
                                        <Globe className="w-4 h-4 text-text-muted" />
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-text-primary">{session.device}</p>
                                        {session.current && (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-500">
                                                Current
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-text-muted">{session.browser} • {session.location}</p>
                                    <div className="flex items-center gap-1 mt-1 text-[10px] text-text-muted">
                                        <Clock className="w-3 h-3" />
                                        {session.lastActive}
                                    </div>
                                </div>
                            </div>
                            {!session.current && (
                                <button
                                    onClick={() => handleRevokeSession(session.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    Sign out
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Security Tips */}
            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                <h4 className="text-xs font-medium text-text-primary mb-2">Security Tips</h4>
                <ul className="text-[11px] text-text-muted space-y-1">
                    <li>• Use a unique password that you don't use elsewhere</li>
                    <li>• Enable two-factor authentication when available</li>
                    <li>• Regularly review your active sessions</li>
                    <li>• Revoke API tokens you no longer use</li>
                </ul>
            </div>
        </div>
    );
}
