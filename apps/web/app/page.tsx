'use client';

import Link from 'next/link';
import { Apple } from 'lucide-react';
import { useAuth } from '@numezis/ui/context/AuthContext';

const downloadUrl = '/pricing' // Points to pricing page with download links

// Feature data - using muted zinc colors instead of vibrant gradients
const features = [
  {
    id: 'deep-agents',
    title: 'Deep Agents',
    subtitle: 'Multi-step AI that understands your entire codebase',
    description: 'Go beyond simple autocomplete. Deep Agents research, plan, and execute complex tasks across your repository with full context awareness.',
    bullets: ['Full codebase understanding', 'Multi-file refactoring', 'Autonomous task execution', 'Context-aware suggestions'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    id: 'campaigns',
    title: 'Campaigns',
    subtitle: 'Orchestrate changes at scale',
    description: 'Run coordinated refactoring across multiple repositories. Define goals, track progress, and rollback with confidence.',
    bullets: ['Multi-repo orchestration', 'Progress tracking', 'Rollback capabilities', 'Team collaboration'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    id: 'ide',
    title: 'Full AI-Powered IDE',
    subtitle: 'Built on VS Code, designed for AI',
    description: 'A complete desktop IDE with AI deeply integrated. Full access to your workspace, terminals, and extensions—plus exclusive agentic features not possible in extensions.',
    bullets: ['Native desktop app', 'Full terminal access', 'Extension ecosystem', 'Agentic workflows'],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
  },
  {
    id: 'graph-editor',
    title: 'Visual Graph Editor',
    subtitle: 'Build AI workflows visually',
    description: 'Unlike Cursor or Copilot, Numezis Code offers a true visual graph editor. Design complex agent workflows, chain tools, and visualize execution paths.',
    bullets: ['Drag & drop workflow builder', 'Real-time execution view', 'Reusable agent templates', 'Conditional branching'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    highlight: true,
  },
  {
    id: 'anti-drift',
    title: 'Anti-Drift Detection',
    subtitle: 'Catch divergence before it breaks',
    description: 'The Code Comparator continuously monitors your codebase evolution. Detect unintended changes, track technical debt, and maintain consistency.',
    bullets: ['Real-time drift detection', 'Side-by-side comparison', 'Change impact analysis', 'Consistency enforcement'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    id: 'llm-config',
    title: 'Multi-Provider LLM',
    subtitle: 'Your models, your choice',
    description: 'Connect to Azure OpenAI, OpenAI, Claude, Gemini, or run locally with LM Studio and Ollama. Full control over your AI infrastructure.',
    bullets: ['6+ provider support', 'Local model execution', 'API key management', 'Model switching on-the-fly'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
  },
]

const trustBadges = [
  { icon: '🇪🇺', title: '100% European', description: 'Infrastructure hosted in EU data centers' },
  { icon: '🔒', title: 'GDPR Native', description: 'Privacy by design, not as an afterthought' },
  { icon: '🏛️', title: 'Swiss-Grade Privacy', description: 'Bank-level data protection standards' },
  { icon: '🚫', title: 'No US Surveillance', description: 'Your code stays in Europe. Period.' },
]

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen w-full bg-bg-app">
      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg-app/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-xl">🧠</span>
            <span className="text-sm font-semibold text-text-primary">Numezis Code</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden sm:flex items-center gap-6">
            <Link href="/#features" className="text-sm text-text-muted hover:text-text-primary transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-sm text-text-muted hover:text-text-primary transition-colors">
              Pricing
            </Link>
          </div>

          {/* Auth Buttons */}
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
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-14">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl">
          {/* Logo */}
          <div className="mb-6 text-4xl">
            🧠
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-subtle bg-bg-surface mb-6 text-xs text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Available for macOS, Windows & Linux
          </div>

          {/* Main headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-text-primary mb-4 tracking-tight">
            Code with Confidence.
            <br />
            <span className="text-text-secondary">Built for Europe.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-base text-text-muted mb-2 max-w-xl mx-auto leading-relaxed">
            The AI coding agent that understands your entire codebase. Visual graph workflows,
            multi-repo campaigns, and zero data leaving the EU.
          </p>
          <p className="text-xs text-amber-400 uppercase tracking-[0.2em] mb-6">
            Early Access • Expect rough edges while we polish the Mac experience.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <Link
              href={downloadUrl}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-app px-5 py-2.5 text-sm font-medium hover:bg-text-secondary transition-colors"
            >
              <Apple className="w-4 h-4" />
              Download Mac App
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated px-5 py-2.5 text-sm font-medium text-text-primary transition-colors"
            >
              Explore Features
            </a>
          </div>

          {/* Hero visual - Code editor mockup */}
          <div className="w-full max-w-2xl border border-border-subtle rounded-lg overflow-hidden bg-bg-surface">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-elevated border-b border-border-subtle">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-[10px] text-text-muted font-mono">Numezis Code — AI-Powered IDE</span>
              </div>
            </div>
            {/* Code content */}
            <div className="p-4 font-mono text-xs text-left">
              <div className="flex gap-3 text-text-muted mb-1.5">
                <span className="w-4 text-right opacity-50">1</span>
                <span className="text-text-muted">// 🚀 Numezis Deep Agent analyzing your codebase...</span>
              </div>
              <div className="flex gap-3 text-text-muted mb-1.5">
                <span className="w-4 text-right opacity-50">2</span>
                <span><span className="text-text-secondary">const</span> agent = <span className="text-text-secondary">await</span> numezis.createDeepAgent{'({'}</span>
              </div>
              <div className="flex gap-3 text-text-muted mb-1.5">
                <span className="w-4 text-right opacity-50">3</span>
                <span className="pl-4">goal: <span className="text-text-secondary">&quot;Refactor authentication to OAuth2&quot;</span>,</span>
              </div>
              <div className="flex gap-3 text-text-muted mb-1.5">
                <span className="w-4 text-right opacity-50">4</span>
                <span className="pl-4">scope: <span className="text-text-secondary">&quot;src/auth/**/*.ts&quot;</span>,</span>
              </div>
              <div className="flex gap-3 text-text-muted mb-1.5">
                <span className="w-4 text-right opacity-50">5</span>
                <span className="pl-4">provider: <span className="text-text-secondary">&quot;azure-openai&quot;</span></span>
              </div>
              <div className="flex gap-3 text-text-muted mb-1.5">
                <span className="w-4 text-right opacity-50">6</span>
                <span>{'});'}</span>
              </div>
              <div className="flex gap-3 text-text-muted">
                <span className="w-4 text-right opacity-50">7</span>
                <span className="text-emerald-500/80">✓ 23 files analyzed • 4 refactoring suggestions ready<span className="inline-block w-1.5 h-3 bg-text-muted ml-1 animate-cursor" /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Differentiators Strip */}
      <section className="py-12 px-6 border-y border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-3">
            {['Graph Editor', 'Deep Agents', 'Campaigns', 'Anti-Drift', 'Multi-LLM', 'EU Sovereign'].map((badge) => (
              <div
                key={badge}
                className="px-3 py-1.5 rounded-md border border-border-subtle bg-bg-surface text-xs font-medium text-text-muted"
              >
                {badge}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-3">
              Everything you need to ship faster
            </h2>
            <p className="text-sm text-text-muted max-w-lg mx-auto">
              From intelligent agents to visual workflows, Numezis Code gives you superpowers
              without compromising on privacy or control.
            </p>
          </div>

          {/* Feature cards - grid layout */}
          <div className="grid md:grid-cols-2 gap-4">
            {features.map((feature) => (
              <div
                key={feature.id}
                className={`p-5 rounded-lg border border-border-subtle bg-bg-surface hover:bg-bg-elevated transition-colors ${feature.highlight ? 'ring-1 ring-emerald-500/20' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-md bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted">
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-text-primary">{feature.title}</h3>
                      {feature.highlight && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Key
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mb-3">{feature.subtitle}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {feature.bullets.slice(0, 3).map((bullet) => (
                        <span key={bullet} className="px-2 py-0.5 rounded text-[10px] text-text-muted bg-bg-elevated border border-border-subtle">
                          {bullet}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* European Trust Section */}
      <section className="py-20 px-6 border-y border-border-subtle">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-subtle bg-bg-surface text-xs text-text-muted mb-4">
              <span>🇪🇺</span>
              Made for Europe
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-3">
              Your code deserves European protection
            </h2>
            <p className="text-sm text-text-muted max-w-lg mx-auto">
              In a world of surveillance capitalism, we chose a different path.
              Numezis Code is built by Europeans, for Europeans, with no backdoors.
            </p>
          </div>

          {/* Trust badges grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {trustBadges.map((badge) => (
              <div
                key={badge.title}
                className="p-4 rounded-lg border border-border-subtle bg-bg-surface text-center"
              >
                <div className="text-2xl mb-2">{badge.icon}</div>
                <h3 className="text-sm font-medium text-text-primary mb-1">{badge.title}</h3>
                <p className="text-[11px] text-text-muted">{badge.description}</p>
              </div>
            ))}
          </div>

          {/* Comparison statement */}
          <div className="mt-10 p-5 rounded-lg border border-border-subtle bg-bg-surface text-center">
            <p className="text-xs text-text-muted mb-2">
              While US-based tools are subject to the CLOUD Act and FISA 702...
            </p>
            <p className="text-sm font-medium text-text-primary">
              Your code with Numezis never leaves <span className="text-text-secondary">European jurisdiction</span>.
            </p>
          </div>
        </div>
      </section>

      {/* Data Sovereignty - Compact Version */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Single compact card */}
          <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                Why code sovereignty matters
              </h2>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                US-based AI tools may expose your code to CLOUD Act requests, FISA surveillance, and GDPR compliance risks.
              </p>
            </div>

            {/* Horizontal risk badges */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {[
                { icon: '⚖️', label: 'CLOUD Act', risk: 'Data requests' },
                { icon: '👁️', label: 'FISA 702', risk: 'Surveillance' },
                { icon: '🏛️', label: 'Schrems II', risk: 'GDPR gaps' },
                { icon: '💼', label: 'IP Rights', risk: 'Training data' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-subtle bg-bg-elevated text-xs"
                >
                  <span>{item.icon}</span>
                  <span className="text-text-secondary font-medium">{item.label}</span>
                  <span className="text-text-muted">→ {item.risk}</span>
                </div>
              ))}
            </div>

            {/* CTA strip */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-border-subtle">
              <p className="text-xs text-text-muted">
                Numezis Code: <span className="text-text-secondary">Swiss HQ</span> • <span className="text-text-secondary">EU data centers</span> • <span className="text-text-secondary">No US parent</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Competitor Comparison Section */}
      <section className="py-20 px-6 border-y border-border-subtle">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-3">
              How Numezis Code Compares
            </h2>
            <p className="text-sm text-text-muted max-w-lg mx-auto">
              See why European tech leaders are switching from US-based AI coding tools.
            </p>
          </div>

          {/* Comparison Cards */}
          <div className="grid lg:grid-cols-5 gap-4">
            {/* Numezis Column - Highlighted */}
            <div className="lg:col-span-1 p-5 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500 text-white">
                  Recommended
                </span>
              </div>
              <div className="text-center mb-4 pt-2">
                <span className="text-3xl">🧠</span>
                <h3 className="text-sm font-bold text-text-primary mt-2">Numezis Code</h3>
                <p className="text-[10px] text-emerald-500 font-medium">European • Swiss HQ</p>
              </div>
              <div className="space-y-2.5">
                {[
                  'Visual Graph Editor',
                  'Multi-Repo Campaigns',
                  'Anti-Drift Detection',
                  'Deep Agents',
                  'Local LLM Support',
                  'EU Data Residency',
                  'No CLOUD Act',
                  'Full Desktop IDE',
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-500 text-sm">✓</span>
                    <span className="text-text-secondary">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitors Grid */}
            <div className="lg:col-span-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Cursor */}
              <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="text-center mb-4">
                  <div className="w-8 h-8 rounded-md mx-auto mb-2 flex items-center justify-center">
                    {/* Cursor Logo */}
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                      <rect width="24" height="24" rx="6" fill="#18181B" />
                      <path d="M7 6L17 12L7 18V6Z" fill="#A1A1AA" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-text-primary">Cursor</h3>
                  <p className="text-[10px] text-text-muted">US-based</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Graph Editor</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Campaigns</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-500">✓</span>
                    <span className="text-text-secondary">Deep Agents</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Local LLM</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-red-400">✗</span>
                    <span className="text-red-400/80">EU Residency</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted text-[10px]">Based on</span>
                    <span className="text-text-muted">VS Code</span>
                  </div>
                </div>
              </div>

              {/* GitHub Copilot */}
              <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="text-center mb-4">
                  <div className="w-8 h-8 rounded-md mx-auto mb-2 flex items-center justify-center">
                    {/* GitHub Copilot Logo */}
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" fill="#71717A" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-text-primary">Copilot</h3>
                  <p className="text-[10px] text-text-muted">US-based (Microsoft)</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Graph Editor</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Campaigns</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-amber-500">~</span>
                    <span className="text-text-secondary">Deep Agents</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Local LLM</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-red-400">✗</span>
                    <span className="text-red-400/80">EU Residency</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-500">✓</span>
                    <span className="text-text-secondary">VS Code</span>
                  </div>
                </div>
              </div>

              {/* Cline */}
              <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="text-center mb-4">
                  <div className="w-8 h-8 rounded-md mx-auto mb-2 flex items-center justify-center">
                    {/* Cline Logo - Terminal style */}
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                      <rect width="24" height="24" rx="6" fill="#18181B" />
                      <path d="M7 8L11 12L7 16" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M13 16H17" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-text-primary">Cline</h3>
                  <p className="text-[10px] text-text-muted">US-based (Open Source)</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Graph Editor</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Campaigns</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-500">✓</span>
                    <span className="text-text-secondary">Deep Agents</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-500">✓</span>
                    <span className="text-text-secondary">Local LLM</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-red-400">✗</span>
                    <span className="text-red-400/80">EU Residency</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-500">✓</span>
                    <span className="text-text-secondary">VS Code</span>
                  </div>
                </div>
              </div>

              {/* Windsurf */}
              <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="text-center mb-4">
                  <div className="w-8 h-8 rounded-md mx-auto mb-2 flex items-center justify-center">
                    {/* Windsurf/Codeium Logo - Wave style */}
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                      <rect width="24" height="24" rx="6" fill="#0EA5E9" />
                      <path d="M5 12C5 12 8 8 12 12C16 16 19 12 19 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      <path d="M5 16C5 16 8 12 12 16C16 20 19 16 19 16" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-text-primary">Windsurf</h3>
                  <p className="text-[10px] text-text-muted">US-based (Codeium)</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Graph Editor</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Campaigns</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-500">✓</span>
                    <span className="text-text-secondary">Deep Agents</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted">✗</span>
                    <span className="text-text-muted line-through">Local LLM</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-red-400">✗</span>
                    <span className="text-red-400/80">EU Residency</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-text-muted text-[10px]">Based on</span>
                    <span className="text-text-muted">VS Code</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Note */}
          <div className="mt-8 text-center">
            <p className="text-xs text-text-muted">
              <span className="text-emerald-500">✓</span> Full support •
              <span className="text-amber-500 ml-2">~</span> Partial •
              <span className="text-text-muted ml-2">✗</span> Not available •
              <span className="text-red-400 ml-2">✗</span> Compliance risk
            </p>
          </div>
        </div>
      </section>

      {/* Vision 2032 Section */}
      <section className="py-24 px-6 border-y border-border-subtle">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-subtle bg-bg-surface text-xs text-text-muted mb-4">
              Our Vision
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-4">
              Zero US dependency by 2032
            </h2>
            <p className="text-sm text-text-muted max-w-2xl mx-auto leading-relaxed">
              We're building the future where European entrepreneurs and enterprises
              can build world-class software without ever sending a single line of code
              outside the EU.
            </p>
          </div>

          {/* Vision Cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {/* Card 1 - Tech Independence */}
            <div className="p-5 rounded-lg border border-border-subtle bg-bg-surface">
              <div className="w-8 h-8 rounded-md bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted text-sm mb-4">
                🛡️
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                100% EU Tech Stack
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                From cloud infrastructure to AI models, we're systematically replacing
                every US dependency with European alternatives. No CLOUD Act. No FISA.
                No compromises.
              </p>
            </div>

            {/* Card 2 - Agentic at Scale */}
            <div className="p-5 rounded-lg border border-border-subtle bg-bg-surface">
              <div className="w-8 h-8 rounded-md bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted text-sm mb-4">
                ⚡
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                Agentic Dev at Scale
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Enabling every EU startup and enterprise to leverage autonomous AI agents
                that write, refactor, and ship production-ready code—without leaving
                European jurisdiction.
              </p>
            </div>

            {/* Card 3 - Best-in-Class */}
            <div className="p-5 rounded-lg border border-border-subtle bg-bg-surface">
              <div className="w-8 h-8 rounded-md bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted text-sm mb-4">
                🎯
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                Best-in-Class Accuracy
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Our goal isn't just sovereignty—it's superiority. We're building the most
                accurate, context-aware auto-builder technology that outperforms
                US alternatives.
              </p>
            </div>
          </div>

          {/* Timeline/Roadmap */}
          <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-6 text-center">
              The Path to Digital Sovereignty
            </h3>
            <div className="flex items-center justify-between gap-2">
              {/* 2026 */}
              <div className="flex-1 text-center">
                <div className="w-2 h-2 rounded-full bg-text-secondary mx-auto mb-2" />
                <div className="text-xs font-semibold text-text-primary mb-0.5">2026</div>
                <div className="text-[10px] text-text-muted">
                  Launch EU-first<br />AI coding agent
                </div>
              </div>
              <div className="flex-1 h-px bg-border-subtle max-w-8" />
              {/* 2028 */}
              <div className="flex-1 text-center">
                <div className="w-2 h-2 rounded-full bg-border-subtle mx-auto mb-2" />
                <div className="text-xs font-semibold text-text-secondary mb-0.5">2028</div>
                <div className="text-[10px] text-text-muted">
                  100% EU cloud<br />infrastructure
                </div>
              </div>
              <div className="flex-1 h-px bg-border-subtle max-w-8" />
              {/* 2030 */}
              <div className="flex-1 text-center">
                <div className="w-2 h-2 rounded-full bg-border-subtle mx-auto mb-2" />
                <div className="text-xs font-semibold text-text-secondary mb-0.5">2030</div>
                <div className="text-[10px] text-text-muted">
                  EU-trained<br />foundation models
                </div>
              </div>
              <div className="flex-1 h-px bg-border-subtle max-w-8" />
              {/* 2032 */}
              <div className="flex-1 text-center">
                <div className="w-2 h-2 rounded-full bg-border-subtle mx-auto mb-2" />
                <div className="text-xs font-semibold text-text-secondary mb-0.5">2032</div>
                <div className="text-[10px] text-text-muted">
                  0% US tech<br />dependency
                </div>
              </div>
            </div>
          </div>

          {/* Bottom quote */}
          <div className="mt-8 text-center">
            <p className="text-xs text-text-muted italic">
              "European innovation shouldn't require American permission."
            </p>
          </div>
        </div>
      </section>

      {/* Founders Section */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-subtle bg-bg-surface text-xs text-text-muted mb-3">
              Meet the Team
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary">
              Founded by Swiss Tech Entrepreneurs
            </h2>
          </div>

          {/* Founders Grid */}
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Romain Magnin */}
            <div className="p-5 rounded-lg border border-border-subtle bg-bg-surface text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-xl overflow-hidden border border-border-subtle bg-bg-elevated">
                <img
                  src="/images/founder-romain-magnin.png"
                  alt="Romain Magnin"
                  className="w-full h-full object-cover grayscale"
                />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-0.5">Romain Magnin</h3>
              <p className="text-xs font-medium text-text-secondary">Founder & CEO</p>
              <p className="text-[11px] text-text-muted mb-3">10+ years in Engineering & AI</p>
              <div className="flex justify-center gap-2">
                <a
                  href="https://www.linkedin.com/in/romain-magnin/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-md border border-border-subtle bg-bg-elevated hover:bg-state-hover flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                  aria-label="LinkedIn"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/rom-ai-in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-md border border-border-subtle bg-bg-elevated hover:bg-state-hover flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                  aria-label="GitHub"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Patrick Jaggi */}
            <div className="p-5 rounded-lg border border-border-subtle bg-bg-surface text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-xl overflow-hidden border border-border-subtle bg-bg-elevated">
                <img
                  src="/images/founder-patrick-jaggi.jpg"
                  alt="Patrick Jaggi"
                  className="w-full h-full object-cover grayscale"
                />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-0.5">Patrick Jaggi</h3>
              <p className="text-xs font-medium text-text-secondary">Co-Founder</p>
              <p className="text-[11px] text-text-muted mb-3">25+ years in Tech & Cybersecurity</p>
              <div className="flex justify-center gap-2">
                <a
                  href="https://www.linkedin.com/in/patrick-jaggi-a9236312/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-md border border-border-subtle bg-bg-elevated hover:bg-state-hover flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                  aria-label="LinkedIn"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 px-6 border-y border-border-subtle">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-lg font-semibold text-text-primary mb-3">
            Trusted by European Tech Leaders
          </h2>
          <p className="text-sm text-text-muted mb-8">
            From Swiss fintech to German automotive, leading European companies choose
            Numezis Code for AI-assisted development without compromise.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-text-muted">
            {['Swiss Startups', 'German Enterprise', 'French Scale-ups', 'Nordic Tech'].map((segment) => (
              <div key={segment} className="flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
                {segment}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-4">
            Ready to code with <span className="text-text-secondary">true AI power</span>?
          </h2>
          <p className="text-sm text-text-muted mb-4">
            Download the desktop IDE and experience the future of AI-assisted development.
            Free to start, no credit card required.
          </p>
          <p className="text-xs text-amber-400 uppercase tracking-[0.2em] mb-6">
            Early Access • Built for macOS—with more polish coming soon.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={downloadUrl}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-app px-5 py-2.5 text-sm font-medium hover:bg-text-secondary transition-colors"
            >
              <Apple className="w-4 h-4" />
              Download Mac App
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated px-5 py-2.5 text-sm font-medium text-text-primary transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border-subtle">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-8">
            <div className="flex items-center gap-2">
              <span className="text-base">🧠</span>
              <span className="text-sm text-text-primary font-medium">Numezis Code</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-text-muted">
              <Link href="/pricing" className="hover:text-text-primary transition-colors">Pricing</Link>
              <Link href="/legal/terms" className="hover:text-text-primary transition-colors">Terms of Service</Link>
              <Link href="/legal/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</Link>
              <Link href="/legal/gdpr" className="hover:text-text-primary transition-colors">GDPR</Link>
              <Link href="/legal/cookies" className="hover:text-text-primary transition-colors">Cookies</Link>
              <Link href="/legal/imprint" className="hover:text-text-primary transition-colors">Imprint</Link>
            </div>
          </div>
          <div className="pt-6 border-t border-border-subtle/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
            <span>© 2026 Numezis Technologies SA. All rights reserved.</span>
            <span>🇨🇭 Made in Switzerland • 🇪🇺 GDPR Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
