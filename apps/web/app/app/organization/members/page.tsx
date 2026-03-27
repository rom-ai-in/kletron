'use client';

import { useEffect, useState, useCallback } from 'react';
import { Input, Button, Badge, Modal } from '@kletron/ui/components/design-system';
import { Users, UserPlus, Trash2, Mail, ShieldCheck } from 'lucide-react';

interface MemberInfo {
    user_id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    groups: Array<{ group_id: string; group_name: string; group_role: string }>;
}

interface GroupInfo {
    id: string;
    name: string;
    description: string | null;
    company_id: string;
}

interface OrgData {
    tenant: { id: string; name: string };
    groups: GroupInfo[];
    members: MemberInfo[];
    currentUserRole: string;
}

/** Generate a stable gradient based on a string */
function getAvatarGradient(seed: string): string {
    const gradients = [
        'from-violet-600 to-indigo-600',
        'from-blue-600 to-cyan-500',
        'from-emerald-500 to-teal-500',
        'from-amber-500 to-orange-500',
        'from-rose-500 to-pink-500',
        'from-fuchsia-500 to-purple-500',
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
}

function getInitials(name?: string | null, email?: string | null): string {
    if (name) {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.split('@')[0].slice(0, 2).toUpperCase();
    return 'U';
}

export default function OrganizationMembersPage() {
    const [org, setOrg] = useState<OrgData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Invite state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteGroupId, setInviteGroupId] = useState('');
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [inviteSuccess, setInviteSuccess] = useState('');

    // Remove state
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<MemberInfo | null>(null);

    const fetchOrg = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/organization');
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            if (data.success && data.organization) {
                setOrg(data.organization);
                // Default invite group to first available (only if not already set)
                setInviteGroupId(prev => {
                    if (prev) return prev;
                    return data.organization.groups.length > 0 ? data.organization.groups[0].id : '';
                });
            }
        } catch {
            setError('Unable to load organization');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchOrg(); }, [fetchOrg]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail || !inviteGroupId) return;
        setInviting(true);
        setInviteError('');
        setInviteSuccess('');
        try {
            const res = await fetch('/api/organization/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, groupId: inviteGroupId }),
            });
            const data = await res.json();
            if (data.success) {
                setInviteSuccess(`${inviteEmail} added successfully`);
                setInviteEmail('');
                await fetchOrg();
                setTimeout(() => setInviteSuccess(''), 3000);
            } else {
                setInviteError(data.error || 'Failed to invite');
            }
        } catch {
            setInviteError('Network error');
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (member: MemberInfo) => {
        setRemovingUserId(member.user_id);
        try {
            const res = await fetch('/api/organization/members', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: member.user_id }),
            });
            const data = await res.json();
            if (data.success) {
                setConfirmRemove(null);
                await fetchOrg();
            } else {
                setInviteError(data.error || 'Failed to remove member');
                setConfirmRemove(null);
            }
        } catch {
            setInviteError('Network error while removing member');
            setConfirmRemove(null);
        } finally {
            setRemovingUserId(null);
        }
    };

    const isAdmin = org?.currentUserRole === 'admin';

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-lg bg-bg-surface border border-border-subtle animate-pulse" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-status-error-border bg-status-error-bg p-6">
                <p className="text-sm text-status-error-text">{error}</p>
            </div>
        );
    }

    if (!org) {
        return (
            <div className="rounded-lg border border-border-subtle bg-bg-surface p-8 text-center">
                <Users className="h-10 w-10 text-text-muted mx-auto mb-3" />
                <h2 className="text-sm font-semibold text-text-primary">No Organization</h2>
                <p className="text-xs text-text-muted mt-1">You are not part of any organization.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Invite Section — admin only */}
            {isAdmin && (
                <section className="rounded-lg border border-border-subtle bg-bg-surface p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <UserPlus className="h-4 w-4 text-text-muted" />
                        <h2 className="text-sm font-semibold text-text-primary">Add Member</h2>
                    </div>

                    <form onSubmit={handleInvite} className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
                                <Input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    fullWidth
                                />
                            </div>
                            {org.groups.length > 0 && (
                                <div className="sm:w-48">
                                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Group</label>
                                    <select
                                        value={inviteGroupId}
                                        onChange={(e) => setInviteGroupId(e.target.value)}
                                        className="w-full rounded border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                                    >
                                        {org.groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <Button type="submit" size="sm" loading={inviting} className="sm:self-end">
                                Add
                            </Button>
                        </div>

                        {inviteError && (
                            <div className="rounded border border-status-error-border bg-status-error-bg px-3 py-2">
                                <p className="text-xs text-status-error-text">{inviteError}</p>
                            </div>
                        )}
                        {inviteSuccess && (
                            <div className="rounded border border-status-success-border bg-status-success-bg px-3 py-2">
                                <p className="text-xs text-status-success-text">{inviteSuccess}</p>
                            </div>
                        )}
                    </form>
                </section>
            )}

            {/* Members List */}
            <section className="rounded-lg border border-border-subtle bg-bg-surface p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-text-muted" />
                        <h2 className="text-sm font-semibold text-text-primary">Members</h2>
                    </div>
                    <Badge variant="default" size="sm">{org.members.length}</Badge>
                </div>

                {org.members.length === 0 ? (
                    <p className="text-xs text-text-muted">No members yet.</p>
                ) : (
                    <div className="space-y-2">
                        {org.members.map((member) => {
                            const gradient = getAvatarGradient(member.user_id);
                            const initials = getInitials(member.full_name, member.email);

                            return (
                                <div
                                    key={member.user_id}
                                    className="flex items-center gap-3 rounded border border-border-subtle bg-bg-elevated px-4 py-3"
                                >
                                    {/* Avatar */}
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${gradient} text-white text-xs font-semibold shadow-sm`}>
                                        {initials}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-text-primary truncate">
                                            {member.full_name || member.email.split('@')[0]}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Mail className="h-3 w-3 text-text-muted" />
                                            <p className="text-[11px] text-text-muted truncate">{member.email}</p>
                                        </div>
                                    </div>

                                    {/* Groups */}
                                    <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                                        {member.groups.map((g) => (
                                            <Badge key={g.group_id} variant="default" size="sm">
                                                {g.group_name}
                                                {g.group_role === 'admin' && (
                                                    <ShieldCheck className="h-3 w-3 ml-1 inline-block" />
                                                )}
                                            </Badge>
                                        ))}
                                    </div>

                                    {/* Remove — admin only */}
                                    {isAdmin && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setConfirmRemove(member)}
                                            className="shrink-0"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Error banner for remove failures (shown outside of modal) */}
            {inviteError && !confirmRemove && (
                <div className="rounded border border-status-error-border bg-status-error-bg px-3 py-2">
                    <p className="text-xs text-status-error-text">{inviteError}</p>
                </div>
            )}

            {/* Confirm Remove Modal */}
            {confirmRemove && (
                <Modal
                    open={!!confirmRemove}
                    onClose={() => setConfirmRemove(null)}
                    title="Remove Member"
                >
                    <div className="p-4 space-y-4">
                        <p className="text-sm text-text-secondary">
                            Are you sure you want to remove <strong className="text-text-primary">{confirmRemove.full_name || confirmRemove.email}</strong> from the organization?
                        </p>
                        <p className="text-xs text-text-muted">
                            They will be removed from all groups in this tenant.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(null)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => handleRemove(confirmRemove)}
                                loading={removingUserId === confirmRemove.user_id}
                                className="bg-status-error-text hover:bg-status-error-text/90"
                            >
                                Remove
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
