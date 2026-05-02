"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, CreditCard, ChevronRight } from "lucide-react";

const orgNavItems = [
    {
        label: "General",
        href: "/app/organization",
        icon: Building2,
        description: "Organization name & details",
    },
    {
        label: "Members",
        href: "/app/organization/members",
        icon: Users,
        description: "Manage team members",
    },
    {
        label: "Billing",
        href: "/app/organization/billing",
        icon: CreditCard,
        description: "Subscriptions and invoices",
    },
];

function navItemActive(pathname: string | null, href: string): boolean {
    if (!pathname) return false;
    if (href === "/app/organization") {
        return pathname === "/app/organization" || pathname === "/app/organization/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
}

function headerSubtitle(pathname: string | null): string {
    if (!pathname) return "Organization settings";
    if (pathname === "/app/organization" || pathname === "/app/organization/") {
        return "General — name, tenant details, and workspace defaults.";
    }
    if (pathname.startsWith("/app/organization/members")) {
        return "Members — invite people and manage roles.";
    }
    if (pathname.startsWith("/app/organization/billing")) {
        return "Billing — plan, usage, and invoices.";
    }
    return "Manage your organization and team.";
}

export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex h-full flex-col overflow-hidden bg-bg-app">
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
                        <Building2 className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-text-primary">Organization</h1>
                        <p className="text-sm text-text-muted">{headerSubtitle(pathname)}</p>
                    </div>
                </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-border-subtle bg-bg-surface px-3 py-2 md:hidden">
                {orgNavItems.map((item) => {
                    const active = navItemActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium ${
                                active
                                    ? "bg-state-selected text-text-primary"
                                    : "text-text-secondary hover:bg-state-hover"
                            }`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {item.label}
                        </Link>
                    );
                })}
            </div>

            <div className="flex min-h-0 flex-1">
                <nav
                    className="hidden w-56 shrink-0 border-r border-border-subtle bg-bg-surface py-4 pl-3 pr-2 md:block lg:w-64"
                    aria-label="Organization sections"
                >
                    <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Sections
                    </p>
                    <div className="space-y-0.5">
                        {orgNavItems.map((item) => {
                            const active = navItemActive(pathname, item.href);
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-lg p-2.5 transition-colors ${
                                        active
                                            ? "bg-state-selected text-text-primary"
                                            : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                    }`}
                                >
                                    <Icon
                                        className={`h-4 w-4 shrink-0 ${active ? "text-text-primary" : "text-text-muted"}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">{item.label}</p>
                                        <p className="truncate text-[11px] text-text-muted">{item.description}</p>
                                    </div>
                                    <ChevronRight
                                        className={`h-3.5 w-3.5 shrink-0 ${active ? "text-text-muted" : "text-text-muted/50"}`}
                                    />
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                <div className="min-w-0 flex-1 overflow-y-auto scrollbar-elegant">
                    <div className="mx-auto max-w-3xl p-4 sm:p-6">{children}</div>
                </div>
            </div>
        </div>
    );
}
