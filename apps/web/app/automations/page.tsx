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
        key: 'CODE_FULL_REVIEW',
        name: 'Code — full repository review',
        description: 'Map → backend/API → client/UX → security synthesis. Manual snapshot.',
    },
    {
        key: 'CODE_PR_GATE',
        name: 'Code — pull request gate',
        description: 'Change review + ship checklist. Git event on PR.',
    },
    {
        key: 'CODE_SECURITY_WEBHOOK',
        name: 'Code — security review (webhook)',
        description: 'CI-friendly security pass via signed HTTP webhook.',
    },
    {
        key: 'CODE_WEEKLY_HEALTH',
        name: 'Code — weekly health scan',
        description: 'Scheduled hygiene: deps/complexity signals, test/doc drift, summary.',
    },
    {
        key: 'BUSINESS_STRATEGY_PIPELINE',
        name: 'Business — strategy & market',
        description: 'Context → market → competition → priorities → exec brief.',
    },
    {
        key: 'BUSINESS_FUNDRAISING',
        name: 'Business — fundraising prep',
        description: 'Story, market framing, investor Q&A, diligence checklist.',
    },
    {
        key: 'DAILY_FOCUS_PRIORITIES',
        name: 'Daily focus — prioritize today',
        description: 'Memory + Gmail + calendar + todos → urgent vs important → a concrete plan.',
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
