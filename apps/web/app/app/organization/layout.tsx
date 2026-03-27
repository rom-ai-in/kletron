'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Building2,
    Users,
    ChevronRight,
} from 'lucide-react';

const orgNavItems = [
    {
        label: 'General',
        href: '/app/organization',
        icon: Building2,
        description: 'Organization name & details',
    },
    {
        label: 'Members',
        href: '/app/organization/members',
        icon: Users,
        description: 'Manage team members',
    },
];

interface OrganizationLayoutProps {
    children: React.ReactNode;
}

export default function OrganizationLayout({ children }: OrganizationLayoutProps) {
    const pathname = usePathname();

    return (
        <div className="h-full overflow-auto bg-bg-app">
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-text-primary">Organization</h1>
                    <p className="text-sm text-text-muted mt-1">Manage your tenant, company, and team members</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Side Navigation */}
                    <nav className="lg:w-64 shrink-0">
                        <div className="space-y-1">
                            {orgNavItems.map((item) => {
                                const isActive = pathname === item.href ||
                                    (item.href !== '/app/organization' && pathname?.startsWith(item.href));
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
