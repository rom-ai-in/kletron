'use client';

import Link from 'next/link';
import { useAuth } from '@numezis/ui/context/AuthContext';
import { MarketingHeader, MarketingFooter } from '@numezis/ui/components/design-system';

const pillars = [
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
        description: 'Numezis Code is designed with the EU AI Act in mind. Full transparency in AI decision-making, audit trails, and human oversight built into every workflow.',
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
        description: 'Your source code is your most valuable IP. With Numezis, no code is ever used for model training. Self-hosted options ensure nothing leaves your perimeter.',
        details: [
            'No training on customer code',
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
        description: 'Deploy Numezis Code in your own infrastructure. Full control over data, networking, and access policies.',
        features: [
            'Your infrastructure, your rules',
            'Air-gapped deployment support',
            'Custom network policies',
            'Integration with existing SIEM/SOC',
        ],
    },
    {
        icon: '🔐',
        name: 'Private Cloud',
        badge: 'Dedicated',
        description: 'Dedicated Numezis instance running in an isolated environment, managed by our team with your compliance requirements.',
        features: [
            'Dedicated compute & storage',
            'Custom data residency',
            'Managed by Numezis team',
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
        title: 'Regulated code, sovereign AI',
        description: 'Banks and fintechs across Europe use Numezis Code to accelerate development while meeting BaFin, FINMA, and ECB regulatory requirements. Self-hosted deployment ensures no code leaves your network.',
    },
    {
        icon: '🏥',
        sector: 'Healthcare & Life Sciences',
        title: 'HIPAA-equivalent, EU-hosted',
        description: 'Develop healthcare applications with AI assistance while maintaining full compliance with EU health data regulations. Patient data and proprietary algorithms stay within your infrastructure.',
    },
    {
        icon: '🏛️',
        sector: 'Public Sector & Defense',
        title: 'Digital sovereignty guaranteed',
        description: 'Government agencies and defense contractors require absolute control over their development tools. Numezis Code offers air-gapped deployment with zero external dependencies.',
    },
    {
        icon: '🚗',
        sector: 'Automotive & Manufacturing',
        title: 'Protect industrial IP',
        description: 'From autonomous driving algorithms to smart factory code, European manufacturers trust Numezis Code to keep their competitive advantage within EU jurisdiction.',
    },
];

const testimonials = [
    {
        quote: 'We evaluated Cursor, Copilot, and Windsurf — none could guarantee our code stays in the EU. Numezis was the only option our CISO approved.',
        author: 'Head of Engineering',
        company: 'European Fintech (Series B)',
    },
    {
        quote: 'The self-hosted deployment was running in our Kubernetes cluster within a day. No data leaves our VPC, and the AI agent quality rivals anything from US vendors.',
        author: 'Platform Lead',
        company: 'German Automotive OEM',
    },
    {
        quote: 'GDPR compliance isn\'t a checkbox for us — it\'s the law. Numezis Code is the first AI coding tool we could deploy without months of legal review.',
        author: 'DPO',
        company: 'Nordic Insurance Group',
    },
];

export default function EnterprisePage() {
    const { user, loading } = useAuth();

    return (
        <div className="min-h-screen w-full bg-bg-app">
            {/* Navigation Header */}
            <MarketingHeader
                LinkComponent={Link}
                navLinks={[
                    { href: '/#features', label: 'Features' },
                    { href: '/enterprise', label: 'Enterprise' },
                    { href: '/pricing', label: 'Pricing' },
                ]}
                rightSlot={
                    <div className="flex items-center gap-3">
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-border-subtle border-t-text-secondary rounded-full animate-spin" />
                        ) : user ? (
                            <>
                                <Link
                                    href="/app/explore"
                                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/app/explore"
                                    className="inline-flex items-center gap-2 rounded-md bg-bg-elevated hover:bg-state-hover border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-primary transition-colors"
                                >
                                    Open App →
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/auth/login"
                                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className="inline-flex items-center gap-2 rounded-md bg-text-primary text-bg-app px-3 py-1.5 text-sm font-medium hover:bg-text-secondary transition-colors"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>
                }
            />

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-6">
                <div className="absolute inset-0 bg-grid-pattern opacity-50" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-subtle bg-bg-surface mb-6 text-xs text-text-muted">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                        For EU Enterprises & Organisations
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-text-primary mb-4 tracking-tight">
                        AI Coding, Built for
                        <br />
                        <span className="text-text-secondary">European Sovereignty.</span>
                    </h1>

                    <p className="text-base text-text-muted mb-8 max-w-2xl mx-auto leading-relaxed">
                        The only AI coding platform designed from the ground up for EU compliance.
                        GDPR-native, EU AI Act ready, with Swiss-grade privacy and zero US data exposure.
                        Trusted by enterprises that cannot compromise on data sovereignty.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <a
                            href="mailto:enterprise@numezis.com?subject=Numezis%20Code%20Enterprise%20Inquiry"
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-app px-6 py-2.5 text-sm font-medium hover:bg-text-secondary transition-colors"
                        >
                            Contact Enterprise Sales
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </a>
                        <Link
                            href="/pricing"
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated px-6 py-2.5 text-sm font-medium text-text-primary transition-colors"
                        >
                            View Pricing Plans
                        </Link>
                    </div>
                </div>
            </section>

            {/* Compliance Badges Strip */}
            <section className="py-8 px-6 border-y border-border-subtle">
                <div className="max-w-4xl mx-auto">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider text-center mb-4">
                        Compliance & Certifications
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
            <section className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-3">
                            Why EU Enterprises Choose Numezis
                        </h2>
                        <p className="text-sm text-text-muted max-w-lg mx-auto">
                            Every feature is built with European regulatory requirements and data sovereignty at its core.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {pillars.map((pillar) => (
                            <div
                                key={pillar.title}
                                className="p-6 rounded-lg border border-border-subtle bg-bg-surface hover:bg-bg-elevated transition-colors"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center text-lg">
                                        {pillar.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-text-primary mb-2">{pillar.title}</h3>
                                        <p className="text-xs text-text-muted mb-4 leading-relaxed">{pillar.description}</p>
                                        <div className="space-y-1.5">
                                            {pillar.details.map((detail) => (
                                                <div key={detail} className="flex items-center gap-2">
                                                    <svg className="w-3.5 h-3.5 text-status-success-text shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span className="text-[11px] text-text-secondary">{detail}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* US vs EU Comparison */}
            <section className="py-20 px-6 border-y border-border-subtle">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-3">
                            The Hidden Risk of US-Based AI Tools
                        </h2>
                        <p className="text-sm text-text-muted max-w-lg mx-auto">
                            Using US-headquartered AI coding tools exposes your enterprise to legal and compliance risks
                            that most organizations underestimate.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {/* US Tools */}
                        <div className="p-6 rounded-lg border border-status-error-border bg-status-error-bg/30">
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

                        {/* Numezis */}
                        <div className="p-6 rounded-lg border border-status-success-border bg-status-success-bg/30">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-lg">🇪🇺</span>
                                <h3 className="text-sm font-semibold text-text-primary">Numezis Code</h3>
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
            <section className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-3">
                            Deploy Your Way
                        </h2>
                        <p className="text-sm text-text-muted max-w-lg mx-auto">
                            Whether you need a managed cloud, self-hosted installation, or dedicated private cloud —
                            we adapt to your infrastructure requirements.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        {deploymentOptions.map((option) => (
                            <div
                                key={option.name}
                                className="p-6 rounded-lg border border-border-subtle bg-bg-surface hover:bg-bg-elevated transition-colors"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center text-lg">
                                        {option.icon}
                                    </div>
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
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Security & Administration */}
            <section className="py-20 px-6 border-y border-border-subtle">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-3">
                            Enterprise Security & Administration
                        </h2>
                        <p className="text-sm text-text-muted max-w-lg mx-auto">
                            Everything your IT and security teams need to deploy AI coding tools at scale, with confidence.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {securityFeatures.map((feature) => (
                            <div
                                key={feature.title}
                                className="p-5 rounded-lg border border-border-subtle bg-bg-surface"
                            >
                                <div className="text-lg mb-3">{feature.icon}</div>
                                <h3 className="text-sm font-semibold text-text-primary mb-1">{feature.title}</h3>
                                <p className="text-[11px] text-text-muted leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Industry Use Cases */}
            <section className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-3">
                            Trusted Across Regulated Industries
                        </h2>
                        <p className="text-sm text-text-muted max-w-lg mx-auto">
                            From banking to healthcare, European enterprises in highly regulated sectors
                            rely on Numezis Code.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {useCases.map((useCase) => (
                            <div
                                key={useCase.sector}
                                className="p-6 rounded-lg border border-border-subtle bg-bg-surface hover:bg-bg-elevated transition-colors"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-xl">{useCase.icon}</span>
                                    <div>
                                        <p className="text-[10px] text-text-muted uppercase tracking-wider">{useCase.sector}</p>
                                        <h3 className="text-sm font-semibold text-text-primary">{useCase.title}</h3>
                                    </div>
                                </div>
                                <p className="text-xs text-text-muted leading-relaxed">{useCase.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-20 px-6 border-y border-border-subtle">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-3">
                            What Enterprise Leaders Say
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        {testimonials.map((testimonial, idx) => (
                            <div
                                key={idx}
                                className="p-6 rounded-lg border border-border-subtle bg-bg-surface"
                            >
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
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Enterprise Pricing CTA */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="p-8 rounded-lg border border-border-subtle bg-bg-surface">
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
                                    <a
                                        href="mailto:enterprise@numezis.com?subject=Numezis%20Code%20Enterprise%20Inquiry"
                                        className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-app px-5 py-2.5 text-sm font-medium hover:bg-text-secondary transition-colors"
                                    >
                                        Contact Sales
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </a>
                                    <a
                                        href="mailto:enterprise@numezis.com?subject=Numezis%20Code%20Enterprise%20Demo%20Request"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-bg-elevated hover:bg-state-hover px-5 py-2.5 text-sm font-medium text-text-primary transition-colors"
                                    >
                                        Request a Demo
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 px-6 border-t border-border-subtle">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-4">
                        Ready for <span className="text-text-secondary">sovereign AI coding</span>?
                    </h2>
                    <p className="text-sm text-text-muted mb-8">
                        Join leading European enterprises that trust Numezis Code for compliant,
                        secure, and powerful AI-assisted development.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <a
                            href="mailto:enterprise@numezis.com?subject=Numezis%20Code%20Enterprise%20Inquiry"
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-app px-6 py-2.5 text-sm font-medium hover:bg-text-secondary transition-colors"
                        >
                            Talk to Enterprise Sales
                        </a>
                        <Link
                            href="/pricing"
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated px-6 py-2.5 text-sm font-medium text-text-primary transition-colors"
                        >
                            See All Plans
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <MarketingFooter LinkComponent={Link} />
        </div>
    );
}
