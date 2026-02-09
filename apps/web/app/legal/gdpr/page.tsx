'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    CreditCard,
    Zap,
    FileText,
    ExternalLink,
    ArrowUpRight,
    Check,
    TrendingUp,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { useSubscription } from '@numezis/ui/hooks/useSubscription';

// Plan display configurations
const planConfigs = {
    free: {
        name: 'Starter',
        price: 0,
        period: 'Free forever',
        features: [
            'Bring Your Own Key (BYOK)',
            '1 workspace',
            '3 agent graphs',
            '10K files semantic index',
        ],
    },
    pro: {
        name: 'Pro',
        price: 19,
        period: 'per month',
        features: [
            'Everything in Starter',
            '5 workspaces',
            'Unlimited agent graphs',
            '100K files semantic index',
            '500K hosted tokens/month',
            'Priority support',
        ],
    },
    team: {
        name: 'Team',
        price: 49,
        period: 'per user/month',
        features: [
            'Everything in Pro',
            'Unlimited workspaces',
            'Unlimited semantic index',
            '1M hosted tokens/user/month',
            'Team collaboration',
            'Admin dashboard',
        ],
    },
};

export default function BillingPage() {
    return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-text-muted">Loading...</div>}>
            <BillingPageContent />
        </Suspense>
    );
}

function BillingPageContent() {
    const searchParams = useSearchParams();
    const { subscription, planId, planLimits, loading, error, redirectToPortal, refresh, isFree, isPro } = useSubscription();
    const [portalLoading, setPortalLoading] = useState(false);
    const [portalError, setPortalError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // Check for success/cancel query params
    useEffect(() => {
        if (searchParams?.get('success') === 'true') {
            setShowSuccess(true);
            // Refresh subscription data
            refresh();
            // Clear success message after 5 seconds
            setTimeout(() => setShowSuccess(false), 5000);
        }
    }, [searchParams, refresh]);

    const currentPlan = planConfigs[planId] || planConfigs.free;

    const handleManageBilling = async () => {
        setPortalLoading(true);
        setPortalError(null);

        try {
            await redirectToPortal();
        } catch (err) {
            console.error('Portal error:', err);
            setPortalError(err instanceof Error ? err.message : 'Failed to open billing portal');
            setPortalLoading(false);
        }
    };

    // Calculate token usage (placeholder - would come from actual usage tracking)
    const tokenUsage = {
        used: 0,
        limit: planLimits.hostedTokensPerMonth,
        percentage: planLimits.hostedTokensPerMonth > 0 ? 0 : 0,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Success Message */}
            {showSuccess && (
                <div className="p-4 rounded-lg border border-status-success-border bg-status-success-bg">
                    <div className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-status-success-text" />
                        <p className="text-sm text-status-success-text font-medium">
                            Payment successful! Your subscription is now active.
                        </p>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="p-4 rounded-lg border border-status-error-border bg-status-error-bg">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-status-error-text" />
                        <p className="text-sm text-status-error-text">{error}</p>
                    </div>
                </div>
            )}

            {/* Current Plan */}
            <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-lg font-semibold text-text-primary">{currentPlan.name}</h2>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${subscription?.status === 'active'
                                ? 'bg-status-success-bg text-status-success-text border border-status-success-border'
                                : subscription?.status === 'past_due'
                                    ? 'bg-status-warning-bg text-status-warning-text border border-status-warning-border'
                                    : subscription?.cancelAtPeriodEnd
                                        ? 'bg-status-warning-bg text-status-warning-text border border-status-warning-border'
                                        : 'bg-status-success-bg text-status-success-text border border-status-success-border'
                                }`}>
                                {subscription?.cancelAtPeriodEnd
                                    ? 'Cancels Soon'
                                    : subscription?.status === 'past_due'
                                        ? 'Past Due'
                                        : 'Active'}
                            </span>
                        </div>
                        <p className="text-sm text-text-muted">{currentPlan.period}</p>
                        {subscription?.currentPeriodEnd && (
                            <p className="text-xs text-text-muted mt-1">
                                {subscription.cancelAtPeriodEnd ? 'Expires' : 'Renews'}: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-text-primary">€{currentPlan.price}</p>
                        <p className="text-xs text-text-muted">/month</p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 mb-6">
                    {currentPlan.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-xs text-text-secondary">
                            <Check className="w-3.5 h-3.5 text-status-success-text shrink-0" />
                            {feature}
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap gap-3">
                    {isFree ? (
                        <Link
                            href="/pricing"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-text-primary text-bg-app hover:bg-text-secondary transition-colors"
                        >
                            <ArrowUpRight className="w-4 h-4" />
                            Upgrade Plan
                        </Link>
                    ) : (
                        <>
                            <button
                                onClick={handleManageBilling}
                                disabled={portalLoading}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-text-primary text-bg-app hover:bg-text-secondary transition-colors disabled:opacity-50"
                            >
                                {portalLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CreditCard className="w-4 h-4" />
                                )}
                                Manage Billing
                            </button>
                            <Link
                                href="/pricing"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-bg-elevated border border-border-subtle text-text-primary hover:bg-state-hover transition-colors"
                            >
                                Change Plan
                            </Link>
                        </>
                    )}
                </div>

                {portalError && (
                    <p className="mt-3 text-xs text-status-error-text">{portalError}</p>
                )}
            </div>

            {/* Token Usage */}
            <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-status-success-bg border border-status-success-border flex items-center justify-center">
                        <Zap className="w-5 h-5 text-status-success-text" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-text-primary">AI Token Usage</h3>
                        <p className="text-xs text-text-muted">This billing period</p>
                    </div>
                </div>

                {isFree ? (
                    <div className="p-4 rounded-md bg-bg-elevated border border-border-subtle">
                        <p className="text-sm text-text-secondary mb-2">
                            You&apos;re using <strong>Bring Your Own Key (BYOK)</strong> mode.
                        </p>
                        <p className="text-xs text-text-muted">
                            Token usage is billed directly by your AI provider (OpenAI, Azure, etc.).
                            Upgrade to Pro to get 500K hosted tokens/month included.
                        </p>
                        <Link
                            href="/pricing"
                            className="inline-flex items-center gap-1 text-xs text-status-success-text hover:text-status-success-text mt-3"
                        >
                            View Pro benefits
                            <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-text-muted">
                                    {tokenUsage.used.toLocaleString()} / {tokenUsage.limit.toLocaleString()} tokens
                                </span>
                                <span className="text-xs font-medium text-text-secondary">
                                    {tokenUsage.percentage}%
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-status-success transition-all"
                                    style={{ width: `${tokenUsage.percentage}%` }}
                                />
                            </div>
                        </div>
                        <p className="text-[11px] text-text-muted">
                            Overage pricing: €0.002 per 1K tokens after your monthly allowance.
                        </p>
                    </>
                )}
            </div>

            {/* Usage Trends */}
            <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className="w-5 h-5 text-text-muted" />
                    <h3 className="text-sm font-semibold text-text-primary">Usage Trends</h3>
                </div>

                <div className="h-32 flex items-center justify-center border border-dashed border-border-subtle rounded-md">
                    <p className="text-xs text-text-muted">Usage analytics coming soon</p>
                </div>
            </div>

            {/* Payment Method & Invoices - Only show for paid plans */}
            {!isFree && (
                <>
                    {/* Payment Method */}
                    <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                        <div className="flex items-center gap-3 mb-4">
                            <CreditCard className="w-5 h-5 text-text-muted" />
                            <h3 className="text-sm font-semibold text-text-primary">Payment Method</h3>
                        </div>

                        <div className="p-4 rounded-md bg-bg-elevated border border-border-subtle">
                            <p className="text-sm text-text-secondary">
                                Manage your payment methods in the Stripe billing portal.
                            </p>
                            <button
                                onClick={handleManageBilling}
                                disabled={portalLoading}
                                className="mt-3 text-xs text-status-success-text hover:text-status-success-text inline-flex items-center gap-1"
                            >
                                {portalLoading ? 'Loading...' : 'Update payment method'}
                                <ExternalLink className="w-3 h-3" />
                            </button>
                        </div>
                    </div>

                    {/* Invoices */}
                    <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                        <div className="flex items-center gap-3 mb-4">
                            <FileText className="w-5 h-5 text-text-muted" />
                            <h3 className="text-sm font-semibold text-text-primary">Invoices</h3>
                        </div>

                        <div className="p-4 rounded-md bg-bg-elevated border border-border-subtle">
                            <p className="text-sm text-text-secondary">
                                View and download invoices in the Stripe billing portal.
                            </p>
                            <button
                                onClick={handleManageBilling}
                                disabled={portalLoading}
                                className="mt-3 text-xs text-status-success-text hover:text-status-success-text inline-flex items-center gap-1"
                            >
                                {portalLoading ? 'Loading...' : 'View all invoices'}
                                <ExternalLink className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Billing Contact */}
            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                <p className="text-xs text-text-secondary">
                    <strong className="text-text-primary">Billing questions?</strong>{' '}
                    Contact us at{' '}
                    <a href="mailto:billing@numezis.com" className="text-status-success-text hover:underline">billing@numezis.com</a>
                </p>
            </div>
        </div>
    );
}
