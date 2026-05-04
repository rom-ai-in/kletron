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
    marketingBtnPrimary,
    marketingBtnSecondary,
} from '@kletron/ui/components/design-system';

const rows: { feature: string; kletron: string; notes: string }[] = [
    { feature: 'Visual agent graphs (UI + runtime)', kletron: 'Yes', notes: 'Graph editor and executor ship together.' },
    { feature: 'Code agent (repo, terminal, git, patch)', kletron: 'Yes', notes: 'Comparable depth to leading coding agents.' },
    { feature: 'Work agent (research, docs, light writes)', kletron: 'Yes', notes: 'Cowork-style surface, shared runtime.' },
    { feature: 'Custom MCP per workspace', kletron: 'Yes', notes: 'stdio / SSE / HTTP; namespaced tools.' },
    { feature: 'Multi-stage automations + schedules', kletron: 'Yes', notes: 'Cron, webhook, git triggers.' },
    { feature: 'Local LLMs', kletron: 'Yes', notes: 'Ollama, LM Studio, vLLM + cloud APIs.' },
    { feature: 'EU residency & Swiss operator', kletron: 'Yes', notes: 'See /enterprise for deployment.' },
    { feature: 'Self-hosted option', kletron: 'Yes', notes: 'Enterprise; air-gap friendly architecture.' },
];

export default function ComparePage() {
    return (
        <div className="min-h-screen marketing-page-bg text-text-primary">
            <MarketingHeader LinkComponent={Link} />

            <section className="relative overflow-hidden pt-28 pb-10 sm:pt-32">
                <div className="pointer-events-none absolute inset-0 marketing-grid-overlay opacity-60" aria-hidden />
                <div className={`${marketingContainer} relative z-[1] max-w-3xl`}>
                    <MarketingEyebrow className="mb-6">
                        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--kletron-accent)] shadow-[0_0_10px_var(--kletron-accent)]" />
                        Buyer summary
                    </MarketingEyebrow>
                    <MarketingHeroTitle className="mb-5 text-[1.75rem] sm:text-4xl">
                        How Kletron <span className="text-text-secondary">stacks up</span>
                    </MarketingHeroTitle>
                    <MarketingLead className="mx-0 mb-6 max-w-none text-left">
                        Not an exhaustive matrix—vendors move weekly. Use this as a checklist, then validate in your PoC.
                    </MarketingLead>
                    <EarlyAccessBadge />
                </div>
            </section>

            <div className={`${marketingContainer} pb-20 sm:pb-28`}>
                <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/[0.08] bg-bg-surface/30 backdrop-blur-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left text-xs">
                            <thead>
                                <tr className="border-b border-white/[0.06] bg-bg-elevated/50">
                                    <th className="sticky left-0 z-[1] bg-bg-elevated/95 p-3 font-medium text-text-primary backdrop-blur-sm">
                                        Dimension
                                    </th>
                                    <th className="p-3 font-medium text-status-success-text">Kletron</th>
                                    <th className="p-3 font-medium text-text-muted">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr
                                        key={r.feature}
                                        className={`border-b border-white/[0.04] last:border-0 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                                    >
                                        <td className="sticky left-0 z-[1] max-w-[220px] bg-bg-surface/90 p-3 text-text-secondary backdrop-blur-sm sm:max-w-xs">
                                            {r.feature}
                                        </td>
                                        <td className="p-3 text-center font-medium text-status-success-text">{r.kletron}</td>
                                        <td className="p-3 text-text-muted">{r.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <p className="mx-auto mt-8 max-w-3xl text-xs text-text-muted">
                    Head-to-head columns vs Claude Code, Devin, Cursor, Copilot, Windsurf: see the homepage matrix.
                </p>

                <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row">
                    <Link href="/" className={marketingBtnSecondary}>
                        Homepage compare
                    </Link>
                    <Link href="/pricing" className={marketingBtnPrimary}>
                        View pricing
                    </Link>
                </div>
            </div>

            <MarketingFooter LinkComponent={Link} />
        </div>
    );
}
