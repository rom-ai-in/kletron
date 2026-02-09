'use client';

import React from 'react';
import { cn } from '../../lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
 * MarketingHeader — shared fixed header for landing/pricing/enterprise/legal
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface MarketingNavLink {
    href: string;
    label: string;
}

export interface MarketingHeaderProps {
    /** Logo slot — defaults to the Numezis brain+text */
    logo?: React.ReactNode;
    /** Navigation links */
    navLinks?: MarketingNavLink[];
    /** Right-side slot for auth buttons */
    rightSlot?: React.ReactNode;
    /** Link component — pass Next.js <Link> or a plain <a> wrapper */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LinkComponent?: React.ComponentType<any>;
    className?: string;
}

const DefaultLink: React.FC<{ href: string; className?: string; children: React.ReactNode }> = ({
    href,
    className,
    children,
}) => (
    <a href={href} className={className}>
        {children}
    </a>
);

export const MarketingHeader: React.FC<MarketingHeaderProps> = ({
    logo,
    navLinks = [
        { href: '/#features', label: 'Features' },
        { href: '/enterprise', label: 'Enterprise' },
        { href: '/pricing', label: 'Pricing' },
    ],
    rightSlot,
    LinkComponent = DefaultLink,
    className,
}) => {
    const Link = LinkComponent;

    return (
        <header
            className={cn(
                'fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg-app/80 backdrop-blur-lg',
                className,
            )}
        >
            <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
                {/* Logo */}
                {logo ?? (
                    <Link href="/" className="flex items-center gap-2.5">
                        <span className="text-xl">🧠</span>
                        <span className="text-sm font-semibold text-text-primary">Numezis Code</span>
                    </Link>
                )}

                {/* Nav Links */}
                <div className="hidden sm:flex items-center gap-6">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-sm text-text-muted hover:text-text-primary transition-colors"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* Right slot */}
                {rightSlot && <div className="flex items-center gap-3">{rightSlot}</div>}
            </div>
        </header>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * MarketingFooter — shared footer for landing/pricing/enterprise/legal
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface MarketingFooterLink {
    href: string;
    label: string;
}

export interface MarketingFooterProps {
    /** Link component — pass Next.js <Link> or a plain <a> wrapper */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LinkComponent?: React.ComponentType<any>;
    /** Footer links */
    links?: MarketingFooterLink[];
    className?: string;
}

export const MarketingFooter: React.FC<MarketingFooterProps> = ({
    LinkComponent = DefaultLink,
    links = [
        { href: '/enterprise', label: 'Enterprise' },
        { href: '/pricing', label: 'Pricing' },
        { href: '/legal/terms', label: 'Terms of Service' },
        { href: '/legal/privacy', label: 'Privacy Policy' },
        { href: '/legal/gdpr', label: 'GDPR' },
        { href: '/legal/cookies', label: 'Cookies' },
        { href: '/legal/imprint', label: 'Imprint' },
    ],
    className,
}) => {
    const Link = LinkComponent;
    const year = new Date().getFullYear();

    return (
        <footer className={cn('py-12 px-6 border-t border-border-subtle', className)}>
            <div className="max-w-5xl mx-auto">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-8">
                    <div className="flex items-center gap-2">
                        <span className="text-base">🧠</span>
                        <span className="text-sm text-text-primary font-medium">Numezis Code</span>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-text-muted">
                        {links.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="hover:text-text-primary transition-colors"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
                <div className="pt-6 border-t border-border-subtle/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
                    <span>&copy; {year} Numezis Technologies SA. All rights reserved.</span>
                    <span>🇨🇭 Made in Switzerland &bull; 🇪🇺 GDPR Compliant</span>
                </div>
            </div>
        </footer>
    );
};
