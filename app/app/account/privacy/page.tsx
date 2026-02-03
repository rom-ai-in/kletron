'use client';

import { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import Link from 'next/link';
import {
    Shield,
    Download,
    Trash2,
    Eye,
    FileText,
    Clock,
    AlertTriangle,
    ExternalLink,
    Check
} from 'lucide-react';

export default function PrivacyDataPage() {
    const { user } = useAuth();
    const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'done'>('idle');
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');

    const handleExportData = async () => {
        setExportStatus('loading');
        // TODO: Implement actual data export API
        await new Promise(resolve => setTimeout(resolve, 2000));
        setExportStatus('done');
        // Simulate download
        const data = {
            exportedAt: new Date().toISOString(),
            user: {
                id: user?.id,
                email: user?.email,
                createdAt: user?.created_at,
            },
            note: "Full data export functionality coming soon"
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `numezis-data-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDeleteAccount = async () => {
        if (deleteInput !== 'DELETE') return;
        // TODO: Implement actual account deletion API
        alert('Account deletion will be processed. You will receive a confirmation email.');
    };

    return (
        <div className="space-y-6">
            {/* GDPR Rights Overview */}
            <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-text-primary">Your Data Rights</h2>
                        <p className="text-xs text-text-muted">GDPR Articles 15-22</p>
                    </div>
                </div>

                <p className="text-sm text-text-secondary mb-4">
                    As a Numezis Code user, you have full control over your personal data.
                    We are committed to GDPR compliance and Swiss data protection standards.
                </p>

                <div className="grid sm:grid-cols-2 gap-3">
                    {[
                        { icon: Eye, title: 'Right to Access', desc: 'View all data we store about you' },
                        { icon: Download, title: 'Right to Portability', desc: 'Export your data in a standard format' },
                        { icon: FileText, title: 'Right to Rectification', desc: 'Correct inaccurate personal data' },
                        { icon: Trash2, title: 'Right to Erasure', desc: 'Request deletion of your data' },
                    ].map((right) => (
                        <div key={right.title} className="flex items-start gap-2.5 p-3 rounded-md bg-bg-elevated border border-border-subtle">
                            <right.icon className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-medium text-text-primary">{right.title}</p>
                                <p className="text-[11px] text-text-muted">{right.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t border-border-subtle">
                    <Link
                        href="/legal/gdpr"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                        Read our full GDPR compliance statement
                        <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
            </div>

            {/* View My Data */}
            <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                <h3 className="text-sm font-semibold text-text-primary mb-3">What Data We Store</h3>

                <div className="space-y-3">
                    {[
                        {
                            category: 'Account Information',
                            items: ['Email address', 'Full name (if provided)', 'Account creation date'],
                            retention: 'Until account deletion'
                        },
                        {
                            category: 'Usage Data',
                            items: ['Feature usage statistics', 'Agent graph configurations', 'Workspace settings'],
                            retention: '2 years after last activity'
                        },
                        {
                            category: 'Technical Data',
                            items: ['API request logs (anonymized)', 'Error reports', 'Session data'],
                            retention: '90 days'
                        },
                    ].map((section) => (
                        <div key={section.category} className="p-3 rounded-md bg-bg-elevated border border-border-subtle">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-text-primary">{section.category}</p>
                                <div className="flex items-center gap-1 text-[10px] text-text-muted">
                                    <Clock className="w-3 h-3" />
                                    {section.retention}
                                </div>
                            </div>
                            <ul className="space-y-1">
                                {section.items.map((item) => (
                                    <li key={item} className="text-[11px] text-text-secondary flex items-center gap-2">
                                        <span className="w-1 h-1 rounded-full bg-text-muted" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            {/* Export Data */}
            <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                <h3 className="text-sm font-semibold text-text-primary mb-1">Export Your Data</h3>
                <p className="text-xs text-text-muted mb-4">
                    Download a complete copy of all personal data we store about you in JSON format.
                </p>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportData}
                        disabled={exportStatus === 'loading'}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-bg-elevated border border-border-subtle text-text-primary hover:bg-state-hover transition-colors disabled:opacity-50"
                    >
                        {exportStatus === 'loading' ? (
                            <>
                                <div className="w-4 h-4 border-2 border-border-subtle border-t-text-secondary rounded-full animate-spin" />
                                Preparing export...
                            </>
                        ) : exportStatus === 'done' ? (
                            <>
                                <Check className="w-4 h-4 text-emerald-500" />
                                Downloaded
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Download My Data
                            </>
                        )}
                    </button>
                </div>

                <p className="text-[11px] text-text-muted mt-3">
                    Export includes: account info, preferences, agent graphs, and usage history.
                    Code and files from your workspaces are not included (they remain on your local machine).
                </p>
            </div>

            {/* Delete Account */}
            <div className="p-6 rounded-lg border border-red-500/30 bg-red-500/5">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-red-400">Delete Account</h3>
                        <p className="text-xs text-text-muted mt-1">
                            Permanently delete your Numezis Code account and all associated data.
                        </p>
                    </div>
                </div>

                {!deleteConfirm ? (
                    <button
                        onClick={() => setDeleteConfirm(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete My Account
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20">
                            <p className="text-xs text-red-300 font-medium mb-2">⚠️ This action cannot be undone</p>
                            <ul className="text-[11px] text-red-200/80 space-y-1">
                                <li>• All your data will be permanently deleted</li>
                                <li>• Your agent graphs and configurations will be lost</li>
                                <li>• API tokens will be revoked immediately</li>
                                <li>• You will lose access to any paid subscription</li>
                            </ul>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1.5">
                                Type <span className="font-mono text-red-400">DELETE</span> to confirm
                            </label>
                            <input
                                type="text"
                                value={deleteInput}
                                onChange={(e) => setDeleteInput(e.target.value)}
                                className="w-full px-3 py-2 rounded-md border border-red-500/30 bg-bg-elevated text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                placeholder="DELETE"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleteInput !== 'DELETE'}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                Permanently Delete Account
                            </button>
                            <button
                                onClick={() => {
                                    setDeleteConfirm(false);
                                    setDeleteInput('');
                                }}
                                className="px-4 py-2 rounded-md text-sm text-text-secondary hover:text-text-primary transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Contact DPO */}
            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                <p className="text-xs text-text-secondary">
                    <strong className="text-text-primary">Questions about your data?</strong>{' '}
                    Contact our Data Protection Officer at{' '}
                    <a href="mailto:dpo@numezis.com" className="text-emerald-500 hover:underline">dpo@numezis.com</a>
                </p>
            </div>
        </div>
    );
}
