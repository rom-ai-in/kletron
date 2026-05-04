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
    marketingBtnSecondary,
    MarketingCard,
} from '@kletron/ui/components/design-system';
import { GraphBuilderShowcase } from './GraphBuilderShowcase';

const presets = [
    {
        name: 'Simple ReAct (agent graph)',
        blurb: 'Single-node agent with full MCP—fastest path to production chat.',
    },
    {
        name: 'Code Comparator (agent graph)',
        blurb: 'Git-aware diffs plus comparator skill for review workflows.',
    },
    {
        name: 'Drift Analysis (agent graph)',
        blurb: 'Multi-phase intake, scan, delegate, report for long investigations.',
    },
    {
        name: 'Coder Agent (agent graph)',
        blurb: 'Implementation loops with tighter tool policy for safe refactors.',
    },
    {
        name: 'Explorer Agent (agent graph)',
        blurb: 'Read-heavy reconnaissance before any write.',
    },
    {
        name: 'Planner Agent (agent graph)',
        blurb: 'Planning-first node that sequences downstream executors.',
    },
    {
        name: 'Business Analyst',
        blurb: 'Market scan → competitive analysis → requirements with scoring gates.',
    },
    {
        name: 'Company Growth & GTM (work graph)',
        blurb: 'GTM research chain for decks and collateral grounded in workspace sources.',
    },
];

export default function AgentGraphsMarketingPage() {
    const { user } = useAuth();

    return (
        <div className="min-h-screen marketing-page-bg text-text-primary">
            <MarketingHeader LinkComponent={Link} />

            <section className="relative overflow-hidden pt-28 pb-10 sm:pt-32 sm:pb-14">
                <div className="pointer-events-none absolute inset-0 marketing-grid-overlay opacity-60" aria-hidden />
                <div className={`${marketingContainer} relative z-[1]`}>
                    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 xl:gap-14">
                        <div>
                            <MarketingEyebrow className="mb-6">
                                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--kletron-accent)] shadow-[0_0_10px_var(--kletron-accent)]" />
                                Visual agents
                            </MarketingEyebrow>
                            <MarketingHeroTitle className="mb-5 max-w-[20ch] leading-[1.08] sm:max-w-none lg:max-w-[14ch] xl:max-w-none">
                                Compose agents{' '}
                                <span className="text-text-secondary">you can ship.</span>
                            </MarketingHeroTitle>
                            <MarketingLead className="mb-6 max-w-xl lg:mx-0 lg:text-left">
                                Nodes, branches, and MCP scopes—not one endless thread. Design runs your auditors can replay.
                            </MarketingLead>
                            <EarlyAccessBadge className="lg:mx-0" />
                        </div>

                        <div className="min-w-0">
                            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-muted lg:text-left">
                                Graph builder
                            </p>
                            <GraphBuilderShowcase />
                            <p className="mt-3 text-[11px] leading-relaxed text-text-muted lg:text-left">
                                Illustrative UI—branching flow with tool allowlists per node. Open the app to edit conditions, models, and
                                MCP bindings.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <div className={`${marketingContainer} pb-20 sm:pb-28`}>

                <MarketingSectionTitle subtitle="Starter library—extend and fork in your workspace.">
                    Shipped presets
                </MarketingSectionTitle>
                <div className="mb-12 grid gap-3 md:grid-cols-2">
                    {presets.map((p) => (
                        <MarketingCard key={p.name}>
                            <h3 className="mb-1 text-sm font-semibold text-text-primary">{p.name}</h3>
                            <p className="text-xs leading-relaxed text-text-muted">{p.blurb}</p>
                        </MarketingCard>
                    ))}
                </div>

                <div className="mb-12 grid gap-4 md:grid-cols-3">
                    {[
                        { t: 'Composable', d: 'Reuse nodes across teams—no prompt copy-paste.' },
                        { t: 'Observable', d: 'Every hop logged for security and EU AI Act workflows.' },
                        { t: 'Replayable', d: 'Re-run with pinned model + tool versions when auditors ask.' },
                    ].map((x) => (
                        <MarketingCard key={x.t}>
                            <h3 className="mb-2 text-sm font-semibold text-text-primary">{x.t}</h3>
                            <p className="text-xs leading-relaxed text-text-muted">{x.d}</p>
                        </MarketingCard>
                    ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link href={user ? '/app/agent-graphs' : '/auth/register'} className={marketingBtnPrimary}>
                        {user ? 'Open graph editor' : 'Create account'}
                    </Link>
                    <Link href="/automations" className={marketingBtnSecondary}>
                        Pair with automations
                    </Link>
                </div>
            </div>

            <MarketingFooter LinkComponent={Link} />
        </div>
    );
}
