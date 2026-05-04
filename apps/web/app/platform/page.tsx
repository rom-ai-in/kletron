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

const pillars = [
    {
        title: 'Agent graph runtime',
        body: 'LangGraph-style execution: phases, conditional edges, tool allowlists per node, SSE streams, durable state in MongoDB.',
    },
    {
        title: 'Workspaces & context graph',
        body: 'Repo roots, health checks, and ranked context—agents load what matters first for code and docs.',
    },
    {
        title: 'MCP layer',
        body: 'Bundled Kletron MCP (30+ tools) plus external servers per workspace—tools namespaced as serverSlug__toolName.',
    },
    {
        title: 'LLM router',
        body: 'Azure OpenAI, OpenAI, Anthropic, Gemini, LM Studio, Ollama, vLLM—switch per graph, automation stage, or policy.',
    },
    {
        title: 'Skills registry',
        body: 'Composable skills with validation and overlays so agents load only the playbooks they need.',
    },
    {
        title: 'Memory & state',
        body: 'Path-scoped memories, run history, token accounting for hosted vs BYOK—built for audits.',
    },
];

export default function PlatformPage() {
    return (
        <div className="min-h-screen marketing-page-bg text-text-primary">
            <MarketingHeader LinkComponent={Link} />

            <section className="relative overflow-hidden pt-28 pb-12 sm:pt-32 sm:pb-16">
                <div className="pointer-events-none absolute inset-0 marketing-grid-overlay opacity-60" aria-hidden />
                <div className={`${marketingContainer} relative z-[1]`}>
                    <MarketingEyebrow className="mb-6">
                        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--kletron-accent)] shadow-[0_0_10px_var(--kletron-accent)]" />
                        Architecture
                    </MarketingEyebrow>
                    <MarketingHeroTitle className="mb-5 max-w-[16ch] leading-[1.08] sm:max-w-none">
                        One runtime. <span className="text-text-secondary">Two modes.</span>
                    </MarketingHeroTitle>
                    <MarketingLead className="mb-6 max-w-2xl">
                        Desktop shell meets server-side graphs, MCP, and routing—Code and Work share one stack, not two products.
                    </MarketingLead>
                    <EarlyAccessBadge />
                </div>
            </section>

            <div className={`${marketingContainer} pb-20 sm:pb-28`}>
                <MarketingCard className="mb-12 sm:mb-14">
                    <h2 className="mb-4 text-sm font-semibold text-text-primary">Core data flow</h2>
                    <div className="space-y-2 font-mono text-[11px] leading-relaxed text-text-muted sm:text-xs">
                        <div>
                            <span className="text-text-secondary">User</span> → Next.js UI (agent, graphs, automations)
                        </div>
                        <div>
                            → <span className="text-text-secondary">API routes</span> → AgentGraphExecutor / automation scheduler
                        </div>
                        <div>
                            → <span className="text-text-secondary">ReactAgentRunner</span> → LLM provider (stream)
                        </div>
                        <div>
                            ⇄ <span className="text-text-secondary">McpClient + MultiClient</span> ⇄ bundled MCP + workspace servers
                        </div>
                        <div>
                            → <span className="text-text-secondary">MongoDB</span> (graphs, runs, workspaces, memories)
                        </div>
                    </div>
                    <p className="mt-4 text-[11px] text-text-muted">
                        Enterprise evaluations: ask for the architecture pack—it mirrors this map.
                    </p>
                </MarketingCard>

                <MarketingSectionTitle subtitle="How the product is wired in code—not a slide outline.">
                    Six pillars
                </MarketingSectionTitle>
                <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pillars.map((p) => (
                        <MarketingCard key={p.title}>
                            <h3 className="mb-2 text-sm font-semibold text-text-primary">{p.title}</h3>
                            <p className="text-xs leading-relaxed text-text-muted">{p.body}</p>
                        </MarketingCard>
                    ))}
                </div>

                <MarketingCard className="mb-10">
                    <h2 className="mb-2 text-sm font-semibold text-text-primary">Open standards</h2>
                    <p className="text-xs leading-relaxed text-text-muted">
                        LangGraph-style graphs, MCP for tools, OpenAI-compatible APIs, SSE for streams, VS Code for editing—no proprietary
                        runtime lock-in.
                    </p>
                </MarketingCard>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link href="/agent-graphs" className={marketingBtnPrimary}>
                        Explore graphs
                    </Link>
                    <Link href="/mcp" className={marketingBtnSecondary}>
                        MCP & models
                    </Link>
                </div>
            </div>

            <MarketingFooter LinkComponent={Link} />
        </div>
    );
}
