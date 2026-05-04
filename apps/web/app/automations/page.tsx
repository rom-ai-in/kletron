'use client';

import Link from 'next/link';
import { useAuth } from '@kletron/ui/context/AuthContext';
import {
    MarketingHeader,
    MarketingFooter,
    EarlyAccessBadge,
    marketingContainer,
    MarketingEyebrow,
    MarketingHeroTitle,
    MarketingLead,
    MarketingSectionTitle,
    marketingBtnPrimary,
    MarketingCard,
} from '@kletron/ui/components/design-system';

const presets = [
    {
        key: 'FULL_STACK_LOGIC_AUDIT',
        name: 'Full Stack Logic Audit (Default)',
        description: 'API, backend, frontend, design system, security, performance, delivery.',
    },
    {
        key: 'FULL_AUDIT',
        name: 'Complete Monorepo Audit',
        description: 'Sixteen sequential suites for full-repo coverage.',
    },
    {
        key: 'SECURITY_DEEP_DIVE',
        name: 'Security Deep Dive',
        description: 'Multi-pass security with consolidated high-signal findings.',
    },
    {
        key: 'I18N_QUALITY',
        name: 'I18n Quality Assurance',
        description: 'Structure, completeness, and usage for localization.',
    },
    {
        key: 'API_QUALITY_GATE',
        name: 'API Quality Gate',
        description: 'Fast pre-merge API checks—security and tests.',
    },
    {
        key: 'FULL_BACKEND_AUDIT',
        name: 'Full Backend Audit',
        description: 'API, workers, infra, errors, security—backend-tuned.',
    },
    {
        key: 'CONTINUOUS_IMPROVEMENT',
        name: 'Continuous Improvement (Daily)',
        description: 'Scheduled discovery and hygiene—cron-friendly ops graph.',
    },
];

const triggers = [
    { type: 'manual', note: 'Start from UI or API when operators need a run.' },
    { type: 'schedule', note: 'Cron + timezone—nightly audits and bots.' },
    { type: 'webhook', note: 'Signed HTTP for CI, tickets, orchestrators.' },
    { type: 'git_event', note: 'Push / PR / tag filters tied to the dev loop.' },
];

export default function AutomationsMarketingPage() {
    const { user } = useAuth();

    return (
        <div className="min-h-screen marketing-page-bg text-text-primary">
            <MarketingHeader LinkComponent={Link} />

            <section className="relative overflow-hidden pt-28 pb-12 sm:pt-32 sm:pb-14">
                <div className="pointer-events-none absolute inset-0 marketing-grid-overlay opacity-60" aria-hidden />
                <div className={`${marketingContainer} relative z-[1]`}>
                    <MarketingEyebrow className="mb-6">
                        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--kletron-accent)] shadow-[0_0_10px_var(--kletron-accent)]" />
                        Scheduled & event-driven
                    </MarketingEyebrow>
                    <MarketingHeroTitle className="mb-5 max-w-[18ch] leading-[1.08] sm:max-w-none">
                        Agents that run{' '}
                        <span className="text-text-secondary">on your clock.</span>
                    </MarketingHeroTitle>
                    <MarketingLead className="mb-6 max-w-2xl">
                        Multi-stage pipelines over graphs: explicit prompts, provider choice, context handoff—audits and gates as
                        infrastructure.
                    </MarketingLead>
                    <EarlyAccessBadge />
                </div>
            </section>

            <div className={`${marketingContainer} pb-20 sm:pb-28`}>
                <MarketingSectionTitle subtitle="How runs get kicked off in product.">
                    Triggers
                </MarketingSectionTitle>
                <div className="mb-12 grid gap-3 sm:grid-cols-2">
                    {triggers.map((t) => (
                        <MarketingCard key={t.type}>
                            <h3 className="mb-1 font-mono text-sm text-text-secondary">{t.type}</h3>
                            <p className="text-xs leading-relaxed text-text-muted">{t.note}</p>
                        </MarketingCard>
                    ))}
                </div>

                <MarketingSectionTitle subtitle="From AutomationConfigBuilder—more presets ship in-app.">
                    Preset library
                </MarketingSectionTitle>
                <div className="mb-8 space-y-3">
                    {presets.map((p) => (
                        <MarketingCard key={p.key} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-text-primary">{p.name}</h3>
                                <p className="mt-1 text-xs leading-relaxed text-text-muted">{p.description}</p>
                            </div>
                            <span className="shrink-0 font-mono text-[10px] text-text-muted">{p.key}</span>
                        </MarketingCard>
                    ))}
                </div>
                <p className="mb-10 text-[11px] text-text-muted">
                    Browse the full catalog in the app—frontend audit, Mongo performance, docs quality, and more.
                </p>

                <Link href={user ? '/app/automations' : '/auth/register'} className={marketingBtnPrimary}>
                    {user ? 'Open automations' : 'Create account'}
                </Link>
            </div>

            <MarketingFooter LinkComponent={Link} />
        </div>
    );
}
