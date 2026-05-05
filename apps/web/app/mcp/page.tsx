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
    MarketingCard,
    MarketingIconCircle,
} from '@kletron/ui/components/design-system';

const bundledGroups = [
    {
        title: 'Filesystem & editor',
        tools: ['list_files', 'read_file', 'read_file_range', 'write_file', 'str_replace_editor', 'glob_files', 'path utilities'],
    },
    {
        title: 'Git & GitHub',
        tools: ['git_log', 'git_diff', 'git_grep', 'git_blame', 'github_api', 'repo metrics'],
    },
    {
        title: 'Search & symbols',
        tools: ['search_code', 'text_search', 'structural_search', 'semantic_code_search (hybrid)', 'symbols', 'references', 'go_to_definition'],
    },
    {
        title: 'Execution & workspace',
        tools: ['execute_bash', 'workspace_tools', 'workspace_skills', 'skill_loader', 'notify', 'web_search', 'fetch_url'],
    },
];

const providers = ['Azure OpenAI', 'OpenAI', 'Anthropic Claude', 'Google Gemini', 'LM Studio', 'Ollama', 'vLLM'];

export default function McpMarketingPage() {
    return (
        <div className="min-h-screen marketing-page-bg text-text-primary">
            <MarketingHeader LinkComponent={Link} />

            <section className="relative overflow-hidden pt-28 pb-12 sm:pt-32 sm:pb-14">
                <div className="pointer-events-none absolute inset-0 marketing-grid-overlay opacity-60" aria-hidden />
                <div className={`${marketingContainer} relative z-[1]`}>
                    <MarketingEyebrow className="mb-6">
                        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--kletron-accent)] shadow-[0_0_10px_var(--kletron-accent)]" />
                        Tools & connectors
                    </MarketingEyebrow>
                    <MarketingHeroTitle className="mb-5 max-w-[18ch] sm:max-w-none">
                        Plug tools into{' '}
                        <span className="text-text-secondary">every agent.</span>
                    </MarketingHeroTitle>
                    <MarketingLead className="mb-6">
                        Bundled MCP plus workspace servers. External tools stay namespaced{' '}
                        <code className="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[0.85em] text-text-secondary">
                            serverSlug__toolName
                        </code>{' '}
                        so logs and approvals stay readable.
                    </MarketingLead>
                    <EarlyAccessBadge />
                </div>
            </section>

            <div className={`${marketingContainer} pb-20 sm:pb-28`}>
                <MarketingSectionTitle align="start" subtitle="Representative groups—full list lives in the MCP server implementation.">
                    Bundled Kletron MCP
                </MarketingSectionTitle>
                <div className="mb-12 space-y-4">
                    {bundledGroups.map((g) => (
                        <MarketingCard key={g.title}>
                            <h3 className="mb-2 text-sm font-medium text-text-primary">{g.title}</h3>
                            <p className="font-mono text-xs leading-relaxed text-text-muted">{g.tools.join(' · ')}</p>
                        </MarketingCard>
                    ))}
                    <p className="text-[11px] text-text-muted">
                        Tool names map to <code className="font-mono text-text-secondary">apps/mcp-server/tools/</code>.
                    </p>
                </div>

                <MarketingCard className="mb-12">
                    <MarketingIconCircle className="mb-4 text-base">🔌</MarketingIconCircle>
                    <h2 className="mb-2 text-sm font-semibold text-text-primary">Custom workspace MCP</h2>
                    <p className="mb-4 text-xs leading-relaxed text-text-muted">
                        Register servers from the workspace UI or API: stdio, SSE, or streamable HTTP—CRM, tickets, warehouses, bespoke
                        research.
                    </p>
                    <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-bg-elevated/80 p-4 font-mono text-[10px] text-text-muted sm:text-xs">
                        {`POST /api/workspaces/:workspaceId/connectors/mcp-servers
{
  "name": "Acme CRM",
  "slug": "acme",
  "transport": "sse",
  "url": "https://mcp.internal.example/sse",
  "headers": { "Authorization": "Bearer …" }
}`}
                    </pre>
                </MarketingCard>

                <MarketingSectionTitle align="start" subtitle="Same router powers graphs and automations.">
                    Any model
                </MarketingSectionTitle>
                <p className="mb-4 max-w-2xl text-xs text-text-muted">
                    Local-first or burst to hosted tokens—pick what fits policy per stage.
                </p>
                <div className="mb-10 flex flex-wrap justify-center gap-2">
                    {providers.map((p) => (
                        <span
                            key={p}
                            className="rounded-lg border border-white/[0.08] bg-bg-surface/60 px-2.5 py-1 text-[11px] text-text-muted backdrop-blur-sm"
                        >
                            {p}
                        </span>
                    ))}
                </div>

                <Link href="/pricing" className={marketingBtnPrimary}>
                    Pricing: BYOK vs hosted
                </Link>
            </div>

            <MarketingFooter LinkComponent={Link} />
        </div>
    );
}
