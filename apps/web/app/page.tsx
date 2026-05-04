'use client';

import Link from 'next/link';
import { Apple } from 'lucide-react';
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

const downloadUrl = '/pricing';

const features = [
  {
    id: 'graph-editor',
    title: 'Visual agent graphs',
    tagline: 'Compose multi-node agents—not one endless thread.',
    chips: ['Editor + presets', 'Audit trails'],
    highlight: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
  {
    id: 'code-mode',
    title: 'Code mode',
    tagline: 'Repo, terminal, git—agents that ship.',
    chips: ['VS Code desktop', 'Deep tasks'],
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
  },
  {
    id: 'work-mode',
    title: 'Work mode',
    tagline: 'Research & docs—without terminal noise.',
    chips: ['Office ingest', 'Web + fetch'],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .414-.336.75-.75.75h-4.5a.75.75 0 01-.75-.75v-4.25m0-4.15V5.75A2.25 2.25 0 015.25 3.5h13.5a2.25 2.25 0 012.25 2.25v4.15m-18 0h18" />
      </svg>
    ),
  },
  {
    id: 'mcp',
    title: 'Your MCP servers',
    tagline: 'Plug in internal tools per workspace.',
    chips: ['stdio · SSE · HTTP', 'Namespaced tools'],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.621l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
  {
    id: 'llm',
    title: 'Any model',
    tagline: 'Cloud APIs or weights on your hardware.',
    chips: ['BYOK + hosted', '7+ providers'],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
  },
  {
    id: 'automations',
    title: 'Automations',
    tagline: 'Cron, webhooks, git—graphs on a schedule.',
    chips: ['Preset audits', 'Multi-stage'],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    id: 'skills',
    title: 'Skills & memory',
    tagline: 'Playbooks your team reuses.',
    chips: ['Workspace skills', 'Scoped memory'],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.984 8.984 0 0112 21c.966 0 1.893-.152 2.75-.431V18.75c0-1.128.07-2.227.205-3.293M12 6.042A8.967 8.967 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25A8.984 8.984 0 0018 21a8.967 8.967 0 00-6-2.292V6.042z" />
      </svg>
    ),
  },
  {
    id: 'sovereign',
    title: 'Sovereign by design',
    tagline: 'EU infra, Swiss HQ, self-host path.',
    chips: ['GDPR-native', 'Enterprise RBAC'],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

const trustBadges = [
  { icon: '🇪🇺', title: 'EU-hosted', desc: 'Data centers in Europe' },
  { icon: '🔒', title: 'GDPR-native', desc: 'Built for regulation' },
  { icon: '🇨🇭', title: 'Swiss operator', desc: 'No US parent' },
  { icon: '🛡️', title: 'Self-host', desc: 'When air-gap matters' },
];

const comparisonRows: { feature: string; kletron: 'y' | 'p' | 'n'; claudeCode: 'y' | 'p' | 'n'; devin: 'y' | 'p' | 'n'; cline: 'y' | 'p' | 'n'; cursor: 'y' | 'p' | 'n'; copilot: 'y' | 'p' | 'n'; windsurf: 'y' | 'p' | 'n' }[] = [
  { feature: 'Visual agent graphs', kletron: 'y', claudeCode: 'n', devin: 'n', cline: 'n', cursor: 'n', copilot: 'n', windsurf: 'n' },
  { feature: 'Code + work in one product', kletron: 'y', claudeCode: 'p', devin: 'p', cline: 'p', cursor: 'p', copilot: 'p', windsurf: 'p' },
  { feature: 'Custom MCP per workspace', kletron: 'y', claudeCode: 'p', devin: 'n', cline: 'y', cursor: 'p', copilot: 'n', windsurf: 'n' },
  { feature: 'Local LLMs', kletron: 'y', claudeCode: 'p', devin: 'n', cline: 'y', cursor: 'n', copilot: 'n', windsurf: 'n' },
  { feature: 'Automations & schedules', kletron: 'y', claudeCode: 'n', devin: 'p', cline: 'n', cursor: 'n', copilot: 'n', windsurf: 'n' },
  { feature: 'EU residency story', kletron: 'y', claudeCode: 'n', devin: 'n', cline: 'n', cursor: 'n', copilot: 'n', windsurf: 'n' },
  { feature: 'Self-hosted deployment', kletron: 'y', claudeCode: 'n', devin: 'n', cline: 'p', cursor: 'n', copilot: 'n', windsurf: 'n' },
  { feature: 'Deep coding agent', kletron: 'y', claudeCode: 'y', devin: 'y', cline: 'y', cursor: 'y', copilot: 'p', windsurf: 'y' },
];

function CmpCell({ v }: { v: 'y' | 'p' | 'n' }) {
  if (v === 'y') return <span className="text-status-success-text font-medium">✓</span>;
  if (v === 'p') return <span className="text-status-warning-text" title="Partial">~</span>;
  return <span className="text-text-muted">—</span>;
}

export default function HomePage() {
  return (
    <div className="min-h-screen marketing-page-bg text-text-primary">
      <MarketingHeader LinkComponent={Link} />

      <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-24">
        <div className="pointer-events-none absolute inset-0 marketing-grid-overlay opacity-70" aria-hidden />
        <div className={`${marketingContainer} relative z-[1] flex flex-col items-center text-center`}>
          <MarketingEyebrow className="mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--kletron-accent)] shadow-[0_0_10px_var(--kletron-accent)]" />
            Code · Work · Graphs · MCP
          </MarketingEyebrow>

          <MarketingHeroTitle className="mb-5 max-w-[20ch] leading-[1.08] sm:max-w-none">
            Agents for{' '}
            <span className="text-text-secondary">everything you build.</span>
          </MarketingHeroTitle>

          <MarketingLead className="mb-6 px-1">
            Own your models, tools, and graphs. One platform—European infrastructure by default.
          </MarketingLead>
          <EarlyAccessBadge className="mb-8" />

          <div className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-3 mb-12 sm:mb-14">
            <Link href={downloadUrl} className={marketingBtnPrimary}>
              <Apple className="h-4 w-4 opacity-90" />
              Download for Mac
            </Link>
            <Link href="/platform" className={marketingBtnSecondary}>
              See platform
            </Link>
            <a href="#features" className={marketingBtnSecondary}>
              Capabilities
            </a>
          </div>

          <div className="grid w-full max-w-4xl gap-3 sm:gap-4 md:grid-cols-2 text-left">
            <div className="rounded-2xl border border-white/[0.08] bg-bg-surface/50 p-4 sm:p-5 backdrop-blur-md shadow-xl shadow-black/20">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--kletron-accent)]">Code</span>
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-text-muted">Workspace</span>
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-text-secondary sm:text-xs">
                <span className="text-text-muted">goal</span> Refactor auth → OAuth2
                <br />
                <span className="text-text-muted">tools</span> git · patch · bash · semantic search
              </p>
              <p className="mt-3 text-xs font-medium text-status-success-text">23 files · 4 suggested patches</p>
            </div>
            <div className="rounded-2xl border border-status-warning-border/30 bg-bg-surface/50 p-4 sm:p-5 backdrop-blur-md shadow-xl shadow-black/20">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-status-warning-text">Work</span>
                <span className="rounded-md bg-status-warning-bg/50 px-2 py-0.5 text-[10px] text-status-warning-text">Preview</span>
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-text-secondary sm:text-xs">
                <span className="text-text-muted">goal</span> Board deck from docs + metrics
                <br />
                <span className="text-text-muted">tools</span> read_file · web_search · fetch_url
              </p>
              <p className="mt-3 text-xs font-medium text-status-warning-text">Outline ready · graph next</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-bg-surface/30 py-8 backdrop-blur-sm">
        <div className={`${marketingContainer} flex flex-wrap justify-center gap-2`}>
          {['Graphs', 'Code', 'Work', 'MCP', 'Local LLM', 'Automations', 'Skills', 'EU'].map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/[0.08] bg-bg-app/80 px-3 py-1.5 text-[11px] font-medium text-text-secondary"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      <section id="features" className="py-16 sm:py-24">
        <div className={marketingContainer}>
          <MarketingSectionTitle subtitle="Graphs, modes, and tools in one runtime—so procurement matches reality.">
            Built for real workflows
          </MarketingSectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <MarketingCard key={f.id} featured={f.highlight}>
                <div className="flex gap-4">
                  <MarketingIconCircle>{f.icon}</MarketingIconCircle>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">{f.title}</h3>
                      {f.highlight ? (
                        <span className="rounded-md bg-[color:var(--kletron-accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--kletron-accent)]">
                          Differentiator
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-text-muted">{f.tagline}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {f.chips.map((c) => (
                        <span key={c} className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] text-text-secondary">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] py-16 sm:py-20">
        <div className={marketingContainer}>
          <MarketingSectionTitle subtitle="Agents touch more data than autocomplete ever did. Keep jurisdiction intentional.">
            Trust that travels with you
          </MarketingSectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trustBadges.map((b) => (
              <div key={b.title} className="rounded-2xl border border-white/[0.06] bg-bg-surface/40 p-5 text-center backdrop-blur-sm transition hover:border-white/[0.1]">
                <div className="mb-2 text-2xl">{b.icon}</div>
                <h3 className="text-sm font-semibold text-text-primary">{b.title}</h3>
                <p className="mt-1 text-xs text-text-muted">{b.desc}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-xl text-center text-sm text-text-muted">
            US-hosted stacks carry extraterritorial risk. Kletron routes through{' '}
            <span className="text-text-secondary">European infrastructure</span> with Swiss operator discipline.
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className={marketingContainer}>
          <MarketingSectionTitle subtitle="Illustrative matrix—validate in your PoC. Details on Compare.">
            At a glance
          </MarketingSectionTitle>
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-bg-surface/30 shadow-xl shadow-black/25">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-bg-elevated/80">
                    <th className="sticky left-0 z-10 bg-bg-elevated/95 p-3 sm:p-4 font-medium text-text-primary backdrop-blur-sm">Capability</th>
                    <th className="p-3 sm:p-4 text-center font-semibold text-[color:var(--kletron-accent)]">Kletron</th>
                    <th className="p-3 sm:p-4 text-center font-medium text-text-muted">Claude Code</th>
                    <th className="p-3 sm:p-4 text-center font-medium text-text-muted">Devin</th>
                    <th className="p-3 sm:p-4 text-center font-medium text-text-muted">Cline</th>
                    <th className="p-3 sm:p-4 text-center font-medium text-text-muted">Cursor</th>
                    <th className="p-3 sm:p-4 text-center font-medium text-text-muted">Copilot</th>
                    <th className="p-3 sm:p-4 text-center font-medium text-text-muted">Windsurf</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={`border-b border-white/[0.04] last:border-0 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                    >
                      <td className="sticky left-0 z-10 bg-bg-surface/95 p-3 sm:p-4 text-text-secondary backdrop-blur-sm">{row.feature}</td>
                      <td className="bg-[color:var(--kletron-accent)]/10 p-3 sm:p-4 text-center">
                        <CmpCell v={row.kletron} />
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <CmpCell v={row.claudeCode} />
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <CmpCell v={row.devin} />
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <CmpCell v={row.cline} />
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <CmpCell v={row.cursor} />
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <CmpCell v={row.copilot} />
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <CmpCell v={row.windsurf} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] text-text-muted">
            ✓ yes · ~ partial · — not packaged ·{' '}
            <Link href="/compare" className="text-[color:var(--kletron-accent)] underline-offset-2 hover:underline">
              Full comparison
            </Link>
          </p>
        </div>
      </section>

      <section className="border-t border-white/[0.06] py-16 sm:py-24">
        <div className={marketingContainer}>
          <MarketingSectionTitle subtitle="European teams shouldn’t trade capability for jurisdiction.">
            Where we’re headed
          </MarketingSectionTitle>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { t: 'EU stack', d: 'Replace risky dependencies without losing graph-level control.' },
              { t: 'Agentic ops', d: 'Approvals, memory, MCP evidence—not vibes.' },
              { t: 'Accuracy', d: 'Observable agents you can safely delegate to.' },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-white/[0.06] bg-bg-surface/40 p-6 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-text-primary">{x.t}</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className={`${marketingContainer} max-w-3xl`}>
          <MarketingSectionTitle subtitle="Geneva · Engineering & security">Team</MarketingSectionTitle>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { name: 'Romain Magnin', role: 'Founder & CEO', img: '/images/founder-romain-magnin.png', links: true },
              { name: 'Patrick Jaggi', role: 'Co-founder', img: '/images/founder-patrick-jaggi.jpg', links: false },
            ].map((person) => (
              <div key={person.name} className="rounded-2xl border border-white/[0.06] bg-bg-surface/40 p-6 text-center backdrop-blur-sm">
                <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-2xl border border-white/[0.08] bg-bg-elevated">
                  <img src={person.img} alt="" className="h-full w-full object-cover grayscale" />
                </div>
                <h3 className="text-sm font-semibold">{person.name}</h3>
                <p className="text-xs text-text-muted">{person.role}</p>
                {person.links ? (
                  <div className="mt-3 flex justify-center gap-2">
                    <a href="https://www.linkedin.com/in/romain-magnin/" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/[0.08] p-2 text-text-muted hover:text-text-primary" aria-label="LinkedIn">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                    </a>
                    <a href="https://github.com/rom-ai-in" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/[0.08] p-2 text-text-muted hover:text-text-primary" aria-label="GitHub">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>
                    </a>
                  </div>
                ) : (
                  <div className="mt-3 flex justify-center gap-2">
                    <a href="https://www.linkedin.com/in/patrick-jaggi-a9236312/" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/[0.08] p-2 text-text-muted hover:text-text-primary" aria-label="LinkedIn">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] py-14">
        <div className={`${marketingContainer} text-center`}>
          <p className="text-sm font-medium text-text-primary">Teams under regulatory scrutiny</p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-text-muted">
            {['Swiss fintech', 'German OEM', 'French scale-ups', 'Nordic SaaS'].map((x) => (
              <span key={x} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-[color:var(--kletron-accent)]" />
                {x}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20 pt-6 sm:pb-28">
        <div className={`${marketingContainer} max-w-xl text-center`}>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Start with agents you can govern.</h2>
          <p className="mt-3 text-sm text-text-muted">Desktop app · BYOK free tier · No card required.</p>
          <EarlyAccessBadge className="mx-auto mt-5" />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={downloadUrl} className={marketingBtnPrimary}>
              <Apple className="h-4 w-4 opacity-90" />
              Download
            </Link>
            <Link href="/auth/register" className={marketingBtnSecondary}>
              Create account
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter LinkComponent={Link} />
    </div>
  );
}
