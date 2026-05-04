'use client';

import React, { useEffect, useState, type AnchorHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { Github } from 'lucide-react';
import { marketingNavBtnGhost, marketingNavBtnPrimary } from './MarketingPrimitives';

export interface MarketingNavLink {
    href: string;
    label: string;
}

/** Short disclaimer near CTAs — refined pill, readable on mobile */
export const EarlyAccessBadge: React.FC<{ className?: string }> = ({ className }) => (
    <div
        className={cn(
            'inline-flex items-center rounded-full border border-status-warning-border/50 bg-status-warning-bg/40 px-3 py-1.5 text-[10px] sm:text-[11px] font-medium text-status-warning-text tracking-wide',
            className,
        )}
        role="note"
    >
        Early access · capabilities evolve weekly
    </div>
);

export interface MarketingHeaderProps {
    logo?: React.ReactNode;
    navLinks?: MarketingNavLink[];
    rightSlot?: React.ReactNode;
    LinkComponent?: React.ComponentType<any>;
    className?: string;
}

type MarketingFallbackLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };

const DefaultLink: React.FC<MarketingFallbackLinkProps> = ({ href, className, children, ...rest }) => (
    <a href={href} className={className} {...rest}>
        {children}
    </a>
);

const githubRepoUrl = 'https://github.com/rom-ai-in/kletron';

const marketingHeaderExternalBtn =
    'inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium text-text-muted transition hover:text-text-primary hover:bg-white/[0.05]';

function MenuIcon({ open }: { open: boolean }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {open ? (
                <>
                    <path strokeLinecap="round" d="M6 6l12 12" />
                    <path strokeLinecap="round" d="M18 6L6 18" />
                </>
            ) : (
                <>
                    <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                </>
            )}
        </svg>
    );
}

function DefaultHeaderAuth({
    LinkComponent,
}: {
    LinkComponent: React.ComponentType<any>;
}) {
    const Link = LinkComponent;
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="h-8 w-8 shrink-0 rounded-lg border border-white/[0.06] bg-bg-surface/50 flex items-center justify-center">
                <div className="h-3.5 w-3.5 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (user) {
        return (
            <>
                <a
                    href={githubRepoUrl}
                    className={marketingHeaderExternalBtn}
                    target="_blank"
                    rel="noreferrer noopener"
                    title="Kletron on GitHub"
                    aria-label="Kletron on GitHub"
                >
                    <Github className="h-4 w-4" />
                    <span className="hidden sm:inline">GitHub</span>
                </a>
                <Link href="/app/agent" className={marketingNavBtnGhost}>
                    Dashboard
                </Link>
                <Link href="/app/agent" className={marketingNavBtnPrimary}>
                    Open app
                </Link>
            </>
        );
    }

    return (
        <>
            <a
                href={githubRepoUrl}
                className={marketingHeaderExternalBtn}
                target="_blank"
                rel="noreferrer noopener"
                title="Kletron on GitHub"
                aria-label="Kletron on GitHub"
            >
                <Github className="h-4 w-4" />
                <span className="hidden sm:inline">GitHub</span>
            </a>
            <Link href="/auth/login" className={cn(marketingNavBtnGhost, 'hidden min-[400px]:inline-flex')}>
                Sign in
            </Link>
            <Link href="/auth/register" className={marketingNavBtnPrimary}>
                Get started
            </Link>
        </>
    );
}

export const MarketingHeader: React.FC<MarketingHeaderProps> = ({
    logo,
    navLinks = [
        { href: '/platform', label: 'Platform' },
        { href: '/agent-graphs', label: 'Graphs' },
        { href: '/mcp', label: 'MCP' },
        { href: '/work', label: 'Work' },
        { href: '/automations', label: 'Automations' },
        { href: '/enterprise', label: 'Enterprise' },
        { href: '/pricing', label: 'Pricing' },
    ],
    rightSlot,
    LinkComponent = DefaultLink,
    className,
}) => {
    const Link = LinkComponent;
    const [menuOpen, setMenuOpen] = useState(false);
    const slot = rightSlot ?? <DefaultHeaderAuth LinkComponent={LinkComponent} />;

    useEffect(() => {
        if (!menuOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [menuOpen]);

    return (
        <>
            <header
                className={cn(
                    'fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-bg-app/85 backdrop-blur-xl supports-[backdrop-filter]:bg-bg-app/70',
                    className,
                )}
            >
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
                    {logo ?? (
                        <Link href="/" className="flex items-center gap-2.5 shrink-0 min-w-0" onClick={() => setMenuOpen(false)}>
                            <span className="text-lg sm:text-xl leading-none">🧠</span>
                            <span className="text-sm font-semibold text-text-primary tracking-tight truncate">Kletron</span>
                        </Link>
                    )}

                    <nav className="hidden lg:flex flex-1 items-center justify-center gap-1 min-w-0 px-4" aria-label="Main">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-text-muted transition hover:bg-white/[0.04] hover:text-text-primary whitespace-nowrap"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {slot}
                        <button
                            type="button"
                            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-bg-surface/50 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition"
                            aria-expanded={menuOpen}
                            aria-controls="marketing-mobile-nav"
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                            onClick={() => setMenuOpen((o) => !o)}
                        >
                            <MenuIcon open={menuOpen} />
                        </button>
                    </div>
                </div>
            </header>

            {menuOpen ? (
                <div className="fixed inset-0 z-[60] lg:hidden" id="marketing-mobile-nav">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        aria-label="Close menu"
                        onClick={() => setMenuOpen(false)}
                    />
                    <nav
                        className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-white/[0.08] bg-bg-app shadow-2xl"
                        aria-label="Mobile"
                    >
                        <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-4">
                            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Menu</span>
                            <button
                                type="button"
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                                onClick={() => setMenuOpen(false)}
                                aria-label="Close"
                            >
                                <MenuIcon open />
                            </button>
                        </div>
                        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="rounded-xl px-4 py-3 text-[15px] font-medium text-text-primary hover:bg-bg-elevated transition"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <div className="my-3 border-t border-white/[0.06]" />
                            <Link
                                href="/compare"
                                className="rounded-xl px-4 py-3 text-[15px] font-medium text-text-muted hover:bg-bg-elevated hover:text-text-primary transition"
                                onClick={() => setMenuOpen(false)}
                            >
                                Compare
                            </Link>
                            <Link
                                href="/changelog"
                                className="rounded-xl px-4 py-3 text-[15px] font-medium text-text-muted hover:bg-bg-elevated hover:text-text-primary transition"
                                onClick={() => setMenuOpen(false)}
                            >
                                Changelog
                            </Link>
                        </div>
                    </nav>
                </div>
            ) : null}
        </>
    );
};

export interface MarketingFooterLink {
    href: string;
    label: string;
}

export interface MarketingFooterProps {
    LinkComponent?: React.ComponentType<any>;
    links?: MarketingFooterLink[];
    className?: string;
}

const defaultProductLinks: MarketingFooterLink[] = [
    { href: '/platform', label: 'Platform' },
    { href: '/agent-graphs', label: 'Agent graphs' },
    { href: '/mcp', label: 'MCP & models' },
    { href: '/work', label: 'Work' },
    { href: '/automations', label: 'Automations' },
];

const defaultCompanyLinks: MarketingFooterLink[] = [
    { href: '/compare', label: 'Compare' },
    { href: '/changelog', label: 'Changelog' },
    { href: '/enterprise', label: 'Enterprise' },
    { href: '/pricing', label: 'Pricing' },
];

const defaultLegalLinks: MarketingFooterLink[] = [
    { href: '/legal/terms', label: 'Terms' },
    { href: '/legal/privacy', label: 'Privacy' },
    { href: '/legal/gdpr', label: 'GDPR' },
    { href: '/legal/cookies', label: 'Cookies' },
    { href: '/legal/imprint', label: 'Imprint' },
];

export const MarketingFooter: React.FC<MarketingFooterProps> = ({
    LinkComponent = DefaultLink,
    links,
    className,
}) => {
    const Link = LinkComponent;
    const year = new Date().getFullYear();

    return (
        <footer className={cn('border-t border-white/[0.06] bg-bg-app', className)}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                {links ? (
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-10">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🧠</span>
                            <span className="text-sm font-semibold text-text-primary tracking-tight">Kletron</span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-text-muted">
                            {links.map((link) => (
                                <Link key={link.href} href={link.href} className="hover:text-text-primary transition-colors">
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-12">
                        <div className="col-span-2 md:col-span-1">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg">🧠</span>
                                <span className="text-sm font-semibold text-text-primary tracking-tight">Kletron</span>
                            </div>
                            <p className="text-xs text-text-muted leading-relaxed max-w-[16rem]">
                                Agents, graphs, and MCP—built for teams who need control, not just chat.
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">Product</p>
                            <ul className="space-y-2.5">
                                {defaultProductLinks.map((link) => (
                                    <li key={link.href}>
                                        <Link href={link.href} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">Company</p>
                            <ul className="space-y-2.5">
                                {defaultCompanyLinks.map((link) => (
                                    <li key={link.href}>
                                        <Link href={link.href} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">Legal</p>
                            <ul className="space-y-2.5">
                                {defaultLegalLinks.map((link) => (
                                    <li key={link.href}>
                                        <Link href={link.href} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] sm:text-xs text-text-muted">
                    <span>&copy; {year} Kletron SA</span>
                    <span className="text-center sm:text-right">Switzerland · EU infrastructure · GDPR</span>
                </div>
            </div>
        </footer>
    );
};
