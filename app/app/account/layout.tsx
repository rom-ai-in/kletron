'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    User,
    Shield,
    Bell,
    CreditCard,
    KeyRound,
    ChevronRight
} from 'lucide-react';

const accountNavItems = [
    {
        label: 'Profile',
        href: '/app/account',
        icon: User,
        description: 'Manage your personal information',
    },
    {
        label: 'Privacy & Data',
        href: '/app/account/privacy',
        icon: Shield,
        description: 'Download or delete your data',
    },
    {
        label: 'Notifications',
        href: '/app/account/notifications',
        icon: Bell,
        description: 'Email and alert preferences',
    },
    {
        label: 'Billing',
        href: '/app/account/billing',
        icon: CreditCard,
        description: 'Subscriptions and invoices',
    },
    {
        label: 'Security',
        href: '/app/account/security',
        icon: KeyRound,
        description: 'Password and sessions',
    },
];

interface AccountLayoutProps {
    children: React.ReactNode;
}

export default function AccountLayout({ children }: AccountLayoutProps) {
    const pathname = usePathname();

    return (
        <div className="h-full overflow-auto bg-bg-app">
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-text-primary">Account Settings</h1>
                    <p className="text-sm text-text-muted mt-1">Manage your profile, privacy, and preferences</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Side Navigation */}
                    <nav className="lg:w-64 shrink-0">
                        <div className="space-y-1">
                            {accountNavItems.map((item) => {
                                const isActive = pathname === item.href ||
                                    (item.href !== '/app/account' && pathname?.startsWith(item.href));
                                const Icon = item.icon;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive
                                                ? 'bg-state-selected text-text-primary'
                                                : 'text-text-secondary hover:bg-state-hover hover:text-text-primary'
                                            }`}
                                    >
                                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-text-primary' : 'text-text-muted'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{item.label}</p>
                                            <p className="text-[11px] text-text-muted truncate">{item.description}</p>
                                        </div>
                                        <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-text-muted' : 'text-text-muted/50'}`} />
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Legal Links */}
                        <div className="mt-6 pt-6 border-t border-border-subtle">
                            <p className="px-3 text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">Legal</p>
                            <div className="space-y-1">
                                <Link href="/legal/terms" className="block px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">
                                    Terms of Service
                                </Link>
                                <Link href="/legal/privacy" className="block px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">
                                    Privacy Policy
                                </Link>
                                <Link href="/legal/gdpr" className="block px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">
                                    GDPR Compliance
                                </Link>
                            </div>
                        </div>
                    </nav>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
