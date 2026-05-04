"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    User,
    Shield,
    Bell,
    KeyRound,
    ChevronRight,
    UserCircle,
} from "lucide-react";

const accountNavItems = [
    {
        label: "Profile",
        href: "/app/account",
        icon: User,
        description: "Manage your personal information",
    },
    {
        label: "Privacy & Data",
        href: "/app/account/privacy",
        icon: Shield,
        description: "Download or delete your data",
    },
    {
        label: "Notifications",
        href: "/app/account/notifications",
        icon: Bell,
        description: "Email and alert preferences",
    },
    {
        label: "Security",
        href: "/app/account/security",
        icon: KeyRound,
        description: "Password and sessions",
    },
];

function navItemActive(pathname: string | null, href: string): boolean {
    if (!pathname) return false;
    if (href === "/app/account") {
        return pathname === "/app/account" || pathname === "/app/account/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
}

function headerSubtitle(pathname: string | null): string {
    if (!pathname) return "Account settings";
    if (pathname === "/app/account" || pathname === "/app/account/") {
        return "Profile — name, password, IDE tokens, and sign out.";
    }
    if (pathname.startsWith("/app/account/privacy")) {
        return "Privacy & Data — export, deletion, and your rights.";
    }
    if (pathname.startsWith("/app/account/notifications")) {
        return "Notifications — email and in-app preferences.";
    }
    if (pathname.startsWith("/app/account/security")) {
        return "Security — password and active sessions.";
    }
    return "Manage your profile, privacy, and preferences.";
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex h-full flex-col overflow-hidden bg-bg-app">
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
                        <UserCircle className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-text-primary">Account</h1>
                        <p className="text-sm text-text-muted">{headerSubtitle(pathname)}</p>
                    </div>
                </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-border-subtle bg-bg-surface px-3 py-2 md:hidden">
                {accountNavItems.map((item) => {
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
                    aria-label="Account sections"
                >
                    <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Sections
                    </p>
                    <div className="space-y-0.5">
                        {accountNavItems.map((item) => {
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

                    <div className="mt-6 border-t border-border-subtle pt-4">
                        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Legal</p>
                        <div className="space-y-0.5">
                            <Link
                                href="/legal/terms"
                                className="block rounded-md px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-state-hover hover:text-text-secondary"
                            >
                                Terms of Service
                            </Link>
                            <Link
                                href="/legal/privacy"
                                className="block rounded-md px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-state-hover hover:text-text-secondary"
                            >
                                Privacy Policy
                            </Link>
                            <Link
                                href="/legal/gdpr"
                                className="block rounded-md px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-state-hover hover:text-text-secondary"
                            >
                                GDPR Compliance
                            </Link>
                        </div>
                    </div>
                </nav>

                <div className="min-w-0 flex-1 overflow-y-auto scrollbar-elegant">
                    <div className="mx-auto max-w-3xl p-4 sm:p-6">{children}</div>
                </div>
            </div>
        </div>
    );
}
