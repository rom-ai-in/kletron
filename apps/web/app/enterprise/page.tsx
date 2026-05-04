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
    MarketingIconCircle,
} from '@kletron/ui/components/design-system';

const pillars = [
    {
        icon: '⚡',
        title: 'Agents in production',
        description:
            'Deploy visual agent graphs, multi-stage automations, and workspace-scoped MCP servers with RBAC, approvals, and full run history—so engineering and ops share one governed control plane.',
        details: [
            'LangGraph-style execution with audit-friendly traces',
            'Cron, webhook, and git triggers for automations',
            'Per-workspace custom MCP (stdio / SSE / streamable HTTP)',
            'BYOK or air-gapped local models (Ollama, LM Studio, vLLM)',
        ],
    },
    {
        icon: '🛡️',
        title: 'GDPR-Native by Design',
        description: 'Built from the ground up for GDPR compliance — not retrofitted. Every data flow, every API call, every storage layer is designed to meet EU regulations without compromise.',
        details: [
            'Data processing agreements included',
            'Right to erasure fully automated',
            'Privacy impact assessments available',
            'Data Protection Officer support',
        ],
    },
    {
        icon: '🏛️',
        title: 'EU AI Act Ready',
        description: 'Kletron is designed with the EU AI Act in mind. Full transparency in AI decision-making, audit trails, and human oversight built into every workflow.',
        details: [
            'Complete AI audit trails',
            'Human-in-the-loop controls',
            'Risk classification documentation',
            'Transparent model provenance',
        ],
    },
    {
        icon: '🔒',
        title: 'Zero Data Leakage',
        description:
            'Your repos, documents, and agent traces are high-value IP. With Kletron, customer data is not used for model training. Self-hosted and private-cloud options keep workloads inside your perimeter.',
        details: [
            'No training on customer data (contractual posture)',
            'End-to-end encryption in transit',
            'Self-hosted deployment option',
            'Air-gapped environment support',
        ],
    },
    {
        icon: '🇨🇭',
        title: 'Swiss-Grade Privacy',
        description: 'Headquartered in Switzerland with EU data centers. Benefit from the world\'s strongest privacy laws — beyond even GDPR — with Swiss Federal Data Protection Act (nFADP) standards.',
        details: [
            'Swiss HQ — no US parent company',
            'EU-only data residency',
            'No CLOUD Act exposure',
            'No FISA 702 surveillance risk',
        ],
    },
];

const deploymentOptions = [
    {
        icon: '☁️',
        name: 'Managed Cloud',
        badge: 'EU-Only',
        description: 'Fully managed SaaS hosted exclusively in EU data centers. Get started in minutes with enterprise-grade SLAs.',
        features: [
            'EU data centers (Frankfurt, Amsterdam, Zurich)',
            '99.9% uptime SLA',
            'Automatic updates & patches',
            'Managed backups & disaster recovery',
        ],
    },
    {
        icon: '🏢',
        name: 'Self-Hosted',
        badge: 'Maximum Control',
        description: 'Deploy Kletron in your own infrastructure. Full control over data, networking, and access policies.',
        features: [
            'Your infrastructure, your rules',
            'Bring local LLMs + custom MCP servers inside the VPC',
            'Air-gapped deployment support',
            'Custom network policies & SIEM/SOC export',
        ],
    },
    {
        icon: '🔐',
        name: 'Private Cloud',
        badge: 'Dedicated',
        description: 'Dedicated Kletron instance running in an isolated environment, managed by our team with your compliance requirements.',
        features: [
            'Dedicated compute & storage',
            'Custom data residency',
            'Managed by Kletron team',
            'Tailored compliance configuration',
        ],
    },
];

const securityFeatures = [
    { icon: '🔑', title: 'SSO / SAML', description: 'Integrate with your existing identity provider — Azure AD, Okta, Google Workspace, or any SAML 2.0 compliant IdP.' },
    { icon: '📋', title: 'Audit Logs', description: 'Complete audit trail of every action — who accessed what, when, and from where. Export to your SIEM.' },
    { icon: '👥', title: 'Role-Based Access', description: 'Granular RBAC with custom roles. Control who can access workspaces, run agents, and modify configurations.' },
    { icon: '🏷️', title: 'SCIM Provisioning', description: 'Automated user lifecycle management. Sync users and groups from your identity provider.' },
    { icon: '📊', title: 'Compliance Reports', description: 'Generate SOC 2 Type II, ISO 27001, and GDPR compliance reports on demand.' },
    { icon: '🌐', title: 'IP Allowlisting', description: 'Restrict access to approved IP ranges. Combine with VPN for defense-in-depth.' },
];

const complianceLogos = [
    { label: 'GDPR', icon: '🇪🇺' },
    { label: 'SOC 2', icon: '🔒' },
    { label: 'ISO 27001', icon: '📋' },
    { label: 'EU AI Act', icon: '🤖' },
    { label: 'nFADP', icon: '🇨🇭' },
    { label: 'NIS2', icon: '🛡️' },
];

const useCases = [
    {
        icon: '🏦',
        sector: 'Financial Services',
        title: 'Regulated workloads, sovereign agents',
        description:
            'Banks and fintechs use Kletron for code, risk memos, and recurring audits—while meeting BaFin, FINMA, and ECB expectations. Self-hosted graphs and MCP keep evidence chains inside your network.',
    },
    {
        icon: '🏥',
        sector: 'Healthcare & Life Sciences',
        title: 'HIPAA-equivalent, EU-hosted',
        description:
            'Ship clinical software and research workflows with agents that read controlled documents, run gated tool calls, and leave tamper-evident traces—without routing trust through non-EU control planes.',
    },
    {
        icon: '🏛️',
        sector: 'Public Sector & Defense',
        title: 'Digital sovereignty guaranteed',
        description:
            'Agencies need more than an IDE: they need agent graphs, automations, and MCP that can be air-gapped. Kletron supports disconnected deployments with on-prem models and internal tool servers.',
    },
    {
        icon: '🚗',
        sector: 'Automotive & Manufacturing',
        title: 'Protect industrial IP',
        description:
            'From ADAS code to factory-floor analytics, manufacturers run Kletron agents on sensitive repos and documents—with EU residency, custom MCP to PLM/ERP, and automation for recurring design reviews.',
    },
];

const testimonials = [
    {
        quote: 'We evaluated Cursor, Copilot, and Windsurf — none could guarantee our code stays in the EU. Kletron was the only option our CISO approved.',
        author: 'Head of Engineering',
        company: 'European Fintech (Series B)',
    },
    {
        quote: 'The self-hosted deployment was running in our Kubernetes cluster within a day. No data leaves our VPC, and the AI agent quality rivals anything from US vendors.',
        author: 'Platform Lead',
        company: 'German Automotive OEM',
    },
    {
        quote: 'GDPR compliance isn\'t a checkbox for us — it\'s the law. Kletron is the first agent platform we could deploy without months of legal review.',
        author: 'DPO',
        company: 'Nordic Insurance Group',
    },
];

export default function EnterprisePage() {
    return (
        <div className="min-h-screen marketing-page-bg text-text-primary">
            <MarketingHeader LinkComponent={Link} />

            <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
                <div className="pointer-events-none absolute inset-0 marketing-grid-overlay opacity-60" aria-hidden />

                <div className={`${marketingContainer} relative z-[1] flex flex-col items-center text-center`}>
                    <MarketingEyebrow className="mb-6">
                        <span className="h-1.5 w-1.5 rounded-full bg-status-success shadow-[0_0_8px_rgba(34,197,94,0.45)]" />
                        Enterprise · EU & regulated teams
                    </MarketingEyebrow>

                    <MarketingHeroTitle className="mb-5 max-w-[22ch] sm:max-w-none">
                        Sovereign agents{' '}
                        <span className="text-text-secondary">for regulated orgs.</span>
                    </MarketingHeroTitle>

                    <MarketingLead className="mb-6 px-1">
                        Graphs, MCP, automations—GDPR-native posture, Swiss operator, EU residency. Prove data flow, approvals, and
                        model choice without US control planes.
                    </MarketingLead>
                    <EarlyAccessBadge className="mb-8 text-center" />

                    <div className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
                        <a href="mailto:enterprise@kletron.com?subject=Kletron%20Enterprise%20Inquiry" className={marketingBtnPrimary}>
                            Talk to sales
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </a>
                        <Link href="/pricing" className={marketingBtnSecondary}>
                            View pricing
                        </Link>
                    </div>
                </div>
            </section>

            {/* Compliance Badges Strip */}
            <section className="border-y border-white/[0.06] bg-bg-surface/30 py-8 backdrop-blur-sm">
                <div className={marketingContainer}>
                    <p className="mb-4 text-center text-[10px] font-medium uppercase tracking-wider text-text-muted">
                        Compliance posture
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        {complianceLogos.map((item) => (
                            <div
                                key={item.label}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-subtle bg-bg-surface text-xs text-text-muted"
                            >
                                <span>{item.icon}</span>
                                <span className="font-medium text-text-secondary">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Core Pillars */}
            <section className="py-16 sm:py-24">
                <div className={marketingContainer}>
                    <MarketingSectionTitle subtitle="Regulation and sovereignty baked in—not bolted on later.">
                        Built for EU reality
                    </MarketingSectionTitle>

                    <div className="grid gap-4 md:grid-cols-2">
                        {pillars.map((pillar) => (
                            <MarketingCard key={pillar.title}>
                                <div className="flex items-start gap-4">
                                    <MarketingIconCircle className="text-lg">{pillar.icon}</MarketingIconCircle>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="mb-2 text-sm font-semibold text-text-primary">{pillar.title}</h3>
                                        <p className="mb-4 text-xs leading-relaxed text-text-muted">{pillar.description}</p>
                                        <div className="space-y-1.5">
                                            {pillar.details.map((detail) => (
                                                <div key={detail} className="flex items-center gap-2">
                                                    <svg className="h-3.5 w-3.5 shrink-0 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span className="text-[11px] text-text-secondary">{detail}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </MarketingCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* US vs EU Comparison */}
            <section className="border-y border-white/[0.06] bg-bg-surface/20 py-16 sm:py-24">
                <div className={marketingContainer}>
                    <MarketingSectionTitle subtitle="Most agent stacks route trust through US vendors. Kletron is structured differently by default.">
                        US tools vs. Kletron
                    </MarketingSectionTitle>

                    <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
                        {/* US Tools */}
                        <div className="rounded-2xl border border-status-error-border bg-status-error-bg/25 p-6 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-lg">🇺🇸</span>
                                <h3 className="text-sm font-semibold text-text-primary">US-Based Tools</h3>
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-status-error-bg text-status-error-text border border-status-error-border">
                                    Risk
                                </span>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { risk: 'CLOUD Act', detail: 'US government can compel data access without your knowledge' },
                                    { risk: 'FISA 702', detail: 'Mass surveillance of non-US persons data — your developers included' },
                                    { risk: 'Schrems II', detail: 'EU-US data transfers face ongoing legal uncertainty' },
                                    { risk: 'Training Data', detail: 'Your proprietary code may be used to train AI models' },
                                    { risk: 'Vendor Lock-in', detail: 'No self-hosted option means no exit strategy' },
                                ].map((item) => (
                                    <div key={item.risk} className="flex items-start gap-2.5">
                                        <svg className="w-4 h-4 text-status-error-text shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        <div>
                                            <span className="text-xs font-medium text-text-primary">{item.risk}</span>
                                            <p className="text-[11px] text-text-muted">{item.detail}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Kletron */}
                        <div className="rounded-2xl border border-status-success-border bg-status-success-bg/25 p-6 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-lg">🇪🇺</span>
                                <h3 className="text-sm font-semibold text-text-primary">Kletron</h3>
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-status-success-bg text-status-success-text border border-status-success-border">
                                    Compliant
                                </span>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { benefit: 'Swiss HQ', detail: 'No US jurisdiction — strongest privacy laws in the world' },
                                    { benefit: 'EU Data Only', detail: '100% EU data residency with verifiable infrastructure' },
                                    { benefit: 'GDPR Native', detail: 'Built-in compliance, not bolted-on after the fact' },
                                    { benefit: 'No Training', detail: 'Your code is never used to train models — contractually guaranteed' },
                                    { benefit: 'Self-Hosted', detail: 'Deploy on-prem or in your own cloud for total control' },
                                ].map((item) => (
                                    <div key={item.benefit} className="flex items-start gap-2.5">
                                        <svg className="w-4 h-4 text-status-success-text shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <div>
                                            <span className="text-xs font-medium text-text-primary">{item.benefit}</span>
                                            <p className="text-[11px] text-text-muted">{item.detail}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Deployment Options */}
            <section className="py-16 sm:py-24">
                <div className={marketingContainer}>
                    <MarketingSectionTitle subtitle="Managed EU cloud, your VPC, or air-gapped—same product surface.">
                        Deploy your way
                    </MarketingSectionTitle>

                    <div className="grid gap-4 md:grid-cols-3">
                        {deploymentOptions.map((option) => (
                            <MarketingCard key={option.name}>
                                <div className="mb-4 flex items-center gap-3">
                                    <MarketingIconCircle className="text-lg">{option.icon}</MarketingIconCircle>
                                    <div>
                                        <h3 className="text-sm font-semibold text-text-primary">{option.name}</h3>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-status-success-bg text-status-success-text border border-status-success-border">
                                            {option.badge}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-xs text-text-muted mb-4 leading-relaxed">{option.description}</p>
                                <div className="space-y-2">
                                    {option.features.map((feature) => (
                                        <div key={feature} className="flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5 text-status-success-text shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className="text-[11px] text-text-secondary">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </MarketingCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* Security & Administration */}
            <section className="border-y border-white/[0.06] bg-bg-surface/20 py-16 sm:py-24">
                <div className={marketingContainer}>
                    <MarketingSectionTitle subtitle="SSO, audit trails, RBAC—run graphs and MCP where IT already trusts.">
                        Security & admin
                    </MarketingSectionTitle>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {securityFeatures.map((feature) => (
                            <MarketingCard key={feature.title} className="p-5 sm:p-5">
                                <div className="mb-3 text-lg">{feature.icon}</div>
                                <h3 className="mb-1 text-sm font-semibold text-text-primary">{feature.title}</h3>
                                <p className="text-[11px] leading-relaxed text-text-muted">{feature.description}</p>
                            </MarketingCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* Industry Use Cases */}
            <section className="py-16 sm:py-24">
                <div className={marketingContainer}>
                    <MarketingSectionTitle subtitle="Patterns teams actually deploy—not slide-deck promises.">
                        Regulated sectors
                    </MarketingSectionTitle>

                    <div className="grid gap-4 md:grid-cols-2">
                        {useCases.map((useCase) => (
                            <MarketingCard key={useCase.sector}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-xl">{useCase.icon}</span>
                                    <div>
                                        <p className="text-[10px] text-text-muted uppercase tracking-wider">{useCase.sector}</p>
                                        <h3 className="text-sm font-semibold text-text-primary">{useCase.title}</h3>
                                    </div>
                                </div>
                                <p className="text-xs leading-relaxed text-text-muted">{useCase.description}</p>
                            </MarketingCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="border-y border-white/[0.06] py-16 sm:py-24">
                <div className={marketingContainer}>
                    <MarketingSectionTitle>What leaders say</MarketingSectionTitle>

                    <div className="grid gap-4 md:grid-cols-3">
                        {testimonials.map((testimonial, idx) => (
                            <MarketingCard key={idx}>
                                <svg className="w-6 h-6 text-text-muted/30 mb-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151C7.563 6.068 6 8.789 6 11h4v10H0z" />
                                </svg>
                                <p className="text-xs text-text-secondary leading-relaxed mb-4 italic">
                                    &ldquo;{testimonial.quote}&rdquo;
                                </p>
                                <div>
                                    <p className="text-xs font-medium text-text-primary">{testimonial.author}</p>
                                    <p className="text-[11px] text-text-muted">{testimonial.company}</p>
                                </div>
                            </MarketingCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* Enterprise Pricing CTA */}
            <section className="py-16 sm:py-24">
                <div className={marketingContainer}>
                    <MarketingCard featured className="p-8">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <h3 className="text-xl font-semibold text-text-primary">Enterprise Plan</h3>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-status-success-bg text-status-success-text border border-status-success-border">
                                        Custom
                                    </span>
                                </div>
                                <p className="text-sm text-text-muted mb-6">
                                    Tailored pricing based on your team size, deployment requirements, and compliance needs.
                                    Includes dedicated onboarding, training, and ongoing support.
                                </p>

                                <div className="grid sm:grid-cols-2 gap-2">
                                    {[
                                        'Self-hosted deployment',
                                        'SSO / SAML integration',
                                        'Custom SLA agreements',
                                        'Dedicated success manager',
                                        'Volume token discounts',
                                        'Audit logs & compliance',
                                        'Custom model configuration',
                                        'Swiss data residency',
                                    ].map((feature) => (
                                        <div key={feature} className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-status-success-text shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className="text-xs text-text-secondary">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="lg:text-right shrink-0">
                                <div className="text-2xl font-bold text-text-primary mb-2">Custom Pricing</div>
                                <p className="text-xs text-text-muted mb-4">Tailored to your organisation</p>
                                <div className="flex flex-col gap-2">
                                    <a href="mailto:enterprise@kletron.com?subject=Kletron%20Enterprise%20Inquiry" className={marketingBtnPrimary}>
                                        Contact sales
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </a>
                                    <a
                                        href="mailto:enterprise@kletron.com?subject=Kletron%20Enterprise%20Demo%20Request"
                                        className={marketingBtnSecondary}
                                    >
                                        Book a demo
                                    </a>
                                </div>
                            </div>
                        </div>
                    </MarketingCard>
                </div>
            </section>

            {/* Final CTA */}
            <section className="border-t border-white/[0.06] py-16 sm:py-24">
                <div className={marketingContainer}>
                    <div className="mx-auto max-w-2xl text-center">
                    <h2 className="mb-4 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl md:text-4xl">
                        Ready for <span className="text-text-secondary">sovereign agents</span>?
                    </h2>
                    <MarketingLead className="mb-6">
                        EU enterprises use Kletron when proof beats promises—graphs, MCP, and runs you can defend in audit.
                    </MarketingLead>
                    <EarlyAccessBadge className="mb-8 text-center" />
                    <div className="flex flex-col justify-center gap-3 sm:flex-row">
                        <a href="mailto:enterprise@kletron.com?subject=Kletron%20Enterprise%20Inquiry" className={marketingBtnPrimary}>
                            Talk to sales
                        </a>
                        <Link href="/pricing" className={marketingBtnSecondary}>
                            See plans
                        </Link>
                    </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <MarketingFooter LinkComponent={Link} />
        </div>
    );
}
