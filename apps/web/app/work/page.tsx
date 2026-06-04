'use client';

import Link from 'next/link';
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
    marketingBtnSecondary,
    MarketingCard,
} from '@kletron/ui/components/design-system';

const capabilities = [
    {
        title: 'Research & briefs',
        body: 'Web search + fetch_url, multi-hop reads, citations to workspace paths—diligence without a separate SKU.',
        shipped: true,
    },
    {
        title: 'Office & PDF ingestion',
        body: 'DOCX, XLSX, PDF and common formats—contracts and board packs on disk, not pasted blobs.',
        shipped: true,
    },
    {
        title: 'Word templates',
        body: 'Reusable document templates anchor consistent letterheads and long-form flows.',
        shipped: true,
    },
    {
        title: 'Business Analyst graph',
        body: 'Market scan → competitive analysis → requirements with scoring gates.',
        shipped: true,
    },
    {
        title: 'Slides & narrative decks',
        body: 'Structured outlines and speaker-ready narratives from /docs. Native PPTX authoring: Preview.',
        shipped: false,
    },
    {
        title: 'Spreadsheet models',
        body: 'Parse XLSX for KPIs and commentary; write-back with formatting guarantees: Preview.',
        shipped: false,
    },
];

export default function WorkMarketingPage() {
    return (
        <div className="min-h-screen marketing-page-bg text-text-primary">
            <MarketingHeader LinkComponent={Link} />

            <section className="relative overflow-hidden pt-28 pb-12 sm:pt-32 sm:pb-14">
                <div className="pointer-events-none absolute inset-0 marketing-grid-overlay opacity-60" aria-hidden />
                <div className={`${marketingContainer} relative z-[1]`}>
                    <MarketingEyebrow className="mb-6">
                        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--kletron-accent)] shadow-[0_0_10px_var(--kletron-accent)]" />
                        Work mode
                    </MarketingEyebrow>
                    <MarketingHeroTitle className="mb-5 max-w-[22ch] leading-[1.08] sm:max-w-none">
                        Agents for{' '}
                        <span className="text-text-secondary">everything but the repo loop.</span>
                    </MarketingHeroTitle>
                    <MarketingLead className="mb-6">
                        Research-first defaults, office ingest, grounded outputs—same runtime as Code mode, different tool surface.
                    </MarketingLead>
                    <EarlyAccessBadge />
                </div>
            </section>

            <div className={`${marketingContainer} pb-20 sm:pb-28`}>
                <MarketingSectionTitle align="start" subtitle="Shipped today vs roadmap—labeled honestly.">
                    Capabilities
                </MarketingSectionTitle>
                <div className="mb-12 grid gap-4 sm:grid-cols-2">
                    {capabilities.map((c) => (
                        <MarketingCard key={c.title} className="relative">
                            {!c.shipped && (
                                <span className="absolute right-4 top-4 rounded-md border border-status-warning-border bg-status-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-status-warning-text">
                                    Preview
                                </span>
                            )}
                            <h3 className="mb-2 pr-16 text-sm font-semibold text-text-primary">{c.title}</h3>
                            <p className="text-xs leading-relaxed text-text-muted">{c.body}</p>
                        </MarketingCard>
                    ))}
                </div>

                <MarketingCard className="mb-10">
                    <h2 className="mb-2 text-sm font-semibold text-text-primary">Why Work + Code?</h2>
                    <p className="text-xs leading-relaxed text-text-muted">
                        One MCP registry, graph editor, and audit trail for engineering and GTM—no shadow stack of writing bots.
                    </p>
                </MarketingCard>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link href="/agent-graphs" className={marketingBtnPrimary}>
                        Graph presets
                    </Link>
                    <Link href="/platform" className={marketingBtnSecondary}>
                        Platform overview
                    </Link>
                </div>
            </div>

            <MarketingFooter LinkComponent={Link} />
        </div>
    );
}
