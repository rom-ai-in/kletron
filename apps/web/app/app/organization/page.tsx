'use client';

import { useEffect, useState } from 'react';
import { Input, Button, Badge, Panel } from '@kletron/ui/components/design-system';
import { Building2, Hash, Users, Layers, Pencil, Check, X } from 'lucide-react';

interface OrgData {
    tenant: { id: string; name: string; slug: string; created_at: string; updated_at: string };
    companies: Array<{ id: string; name: string; slug: string }>;
    groups: Array<{ id: string; name: string; description: string | null; company_id: string }>;
    members: Array<{ user_id: string; email: string; full_name: string | null }>;
    currentUserRole: string;
    stats: { memberCount: number; groupCount: number; companyCount: number };
}

export default function OrganizationPage() {
    const [org, setOrg] = useState<OrgData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Inline editing state
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [saveError, setSaveError] = useState('');

    const fetchOrg = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/organization');
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            if (data.success && data.organization) {
                setOrg(data.organization);
                setEditName(data.organization.tenant.name);
            } else {
                setOrg(null);
            }
        } catch {
            setError('Unable to load organization data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void fetchOrg(); }, []);

    const handleSave = async () => {
        if (!org) return;
        // Client-side guard: reject whitespace-only names
        const trimmed = editName.trim();
        if (trimmed.length === 0) {
            setSaveStatus('error');
            setSaveError('Name cannot be empty');
            return;
        }
        setSaving(true);
        setSaveStatus('idle');
        setSaveError('');
        try {
            const res = await fetch('/api/organization', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: org.tenant.id, name: trimmed }),
            });
            const data = await res.json();
            if (data.success) {
                setSaveStatus('success');
                setEditing(false);
                await fetchOrg();
                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
                setSaveError(data.error || 'Failed to update');
            }
        } catch {
            setSaveStatus('error');
            setSaveError('Network error');
        } finally {
            setSaving(false);
        }
    };

    const isAdmin = org?.currentUserRole === 'admin';

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 rounded-lg bg-bg-surface border border-border-subtle animate-pulse" />
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
                <Building2 className="h-10 w-10 text-text-muted mx-auto mb-3" />
                <h2 className="text-sm font-semibold text-text-primary">No Organization</h2>
                <p className="text-xs text-text-muted mt-1">You are not part of any organization yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Success banner */}
            {saveStatus === 'success' && (
                <div className="rounded border border-status-success-border bg-status-success-bg px-3 py-2">
                    <p className="text-xs text-status-success-text">Organization updated successfully</p>
                </div>
            )}

            {/* Error banner */}
            {saveStatus === 'error' && saveError && (
                <div className="rounded border border-status-error-border bg-status-error-bg px-3 py-2">
                    <p className="text-xs text-status-error-text">{saveError}</p>
                </div>
            )}

            {/* Tenant Details */}
            <section className="rounded-lg border border-border-subtle bg-bg-surface p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-text-primary">Tenant</h2>
                    <Badge variant="info" size="sm">{org.currentUserRole}</Badge>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
                        {editing ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    fullWidth
                                    placeholder="Organization name"
                                />
                                <Button size="sm" onClick={handleSave} loading={saving}>
                                    <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setEditName(org.tenant.name); setSaveStatus('idle'); setSaveError(''); }}>
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="rounded border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary flex-1">
                                    {org.tenant.name}
                                </div>
                                {isAdmin && (
                                    <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">Slug</label>
                        <div className="rounded border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-muted flex items-center gap-2">
                            <Hash className="h-3.5 w-3.5" />
                            {org.tenant.slug}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">Created</label>
                        <div className="rounded border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-muted">
                            {new Date(org.tenant.created_at).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'long', day: 'numeric',
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* Companies */}
            <section className="rounded-lg border border-border-subtle bg-bg-surface p-6">
                <h2 className="text-sm font-semibold text-text-primary mb-4">Companies</h2>
                {org.companies.length === 0 ? (
                    <p className="text-xs text-text-muted">No companies in this tenant.</p>
                ) : (
                    <div className="space-y-2">
                        {org.companies.map((company) => (
                            <div key={company.id} className="flex items-center gap-3 rounded border border-border-subtle bg-bg-elevated px-4 py-3">
                                <Building2 className="h-4 w-4 text-text-muted" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary">{company.name}</p>
                                    <p className="text-[11px] text-text-muted">{company.slug}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Panel className="p-4 text-center">
                    <Users className="h-5 w-5 text-text-muted mx-auto mb-2" />
                    <p className="text-2xl font-semibold text-text-primary">{org.stats.memberCount}</p>
                    <p className="text-[11px] text-text-muted mt-1">Members</p>
                </Panel>
                <Panel className="p-4 text-center">
                    <Layers className="h-5 w-5 text-text-muted mx-auto mb-2" />
                    <p className="text-2xl font-semibold text-text-primary">{org.stats.groupCount}</p>
                    <p className="text-[11px] text-text-muted mt-1">Groups</p>
                </Panel>
                <Panel className="p-4 text-center">
                    <Building2 className="h-5 w-5 text-text-muted mx-auto mb-2" />
                    <p className="text-2xl font-semibold text-text-primary">{org.stats.companyCount}</p>
                    <p className="text-[11px] text-text-muted mt-1">Companies</p>
                </Panel>
            </div>

            {/* Groups */}
            {org.groups.length > 0 && (
                <section className="rounded-lg border border-border-subtle bg-bg-surface p-6">
                    <h2 className="text-sm font-semibold text-text-primary mb-4">Groups</h2>
                    <div className="space-y-2">
                        {org.groups.map((group) => (
                            <div key={group.id} className="flex items-center gap-3 rounded border border-border-subtle bg-bg-elevated px-4 py-3">
                                <Layers className="h-4 w-4 text-text-muted" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary">{group.name}</p>
                                    {group.description && (
                                        <p className="text-[11px] text-text-muted">{group.description}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
