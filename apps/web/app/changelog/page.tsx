'use client';

import Link from 'next/link';
import {
    MarketingHeader,
    MarketingFooter,
    marketingContainer,
    MarketingEyebrow,
    MarketingHeroTitle,
    MarketingLead,
    MarketingCard,
} from '@kletron/ui/components/design-system';

const entries = [
    {
        date: '2026-05-04',
        title: 'Agent platform positioning',
        items: [
            'Homepage, enterprise, and pricing describe Kletron as a sovereign agent platform (Code + Work, graphs, MCP, automations).',
            'Public routes: /platform, /agent-graphs, /mcp, /work, /automations, /compare, /changelog.',
            'Shared nav/footer, Early Access band, OG image, sitemap.',
        ],
    },
];

export default function ChangelogPage() {
    return (
        <div className="min-h-screen marketing-page-bg text-text-primary">
            <MarketingHeader LinkComponent={Link} />

            <section className="relative overflow-hidden pt-28 pb-12 sm:pt-32">
                <div className="pointer-events-none absolute inset-0 marketing-grid-overlay opacity-60" aria-hidden />
                <div className={`${marketingContainer} relative z-[1] max-w-2xl`}>
                    <MarketingEyebrow className="mb-6">Product</MarketingEyebrow>
                    <MarketingHeroTitle className="mb-3 text-[1.75rem] sm:text-4xl">
                        Changelog
                    </MarketingHeroTitle>
                    <MarketingLead className="mx-0 max-w-none text-left">
                        High-level public updates. Full release notes ship with product announcements.
                    </MarketingLead>
                </div>
            </section>

            <div className={`${marketingContainer} pb-20 sm:pb-28`}>
                <ul className="mx-auto max-w-2xl space-y-8">
                    {entries.map((e) => (
                        <li key={e.date}>
                            <MarketingCard className="border-white/[0.06]">
                                <time className="font-mono text-xs text-text-muted">{e.date}</time>
                                <h2 className="mt-2 text-lg font-semibold text-text-primary">{e.title}</h2>
                                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-text-muted">
                                    {e.items.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            </MarketingCard>
                        </li>
                    ))}
                </ul>
            </div>

            <MarketingFooter LinkComponent={Link} />
        </div>
    );
}
