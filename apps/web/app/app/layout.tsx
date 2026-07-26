'use client';
// app/app/layout.tsx
// Layout for authenticated /app/* pages with Sidebar
import React, { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@kletron/ui/context/AuthContext';
import { WorkspaceProvider } from '@kletron/ui/context/WorkspaceContext';
import { Sidebar } from '@kletron/ui/components/Sidebar';
import { AppHeader } from '@kletron/ui/components/AppHeader';
import { AppHeaderCenterProvider } from '@kletron/ui/components/AppHeaderCenterSlot';
import { BreadcrumbOverridesProvider } from '@kletron/ui/components/ui/BreadcrumbOverridesProvider';

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    /**
     * Rail visibility is shell state: the toggle lives in `AppHeader` so it stays
     * reachable once the rail is a narrow strip. ⌘B mirrors the desktop shortcut.
     */
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const toggleSidebar = useCallback(() => setSidebarCollapsed((prev) => !prev), []);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.shiftKey) return;
            if (event.key !== 'b' && event.key !== 'B') return;
            // Rich-text editors own ⌘B for bold — don't steal it from them.
            const target = event.target as HTMLElement | null;
            if (target?.isContentEditable) return;
            event.preventDefault();
            toggleSidebar();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [toggleSidebar]);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            const query = searchParams?.toString();
            const redirectTarget = pathname
                ? (query ? `${pathname}?${query}` : pathname)
                : '/app';
            router.replace(`/auth/login?redirect=${encodeURIComponent(redirectTarget)}`);
        }
    }, [user, loading, pathname, router, searchParams]);

    // Show loading while checking auth
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-bg-app">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-border-subtle border-t-text-secondary rounded-full animate-spin" />
                    <p className="text-sm text-text-muted">Loading...</p>
                </div>
            </div>
        );
    }

    // Not authenticated - show redirect spinner
    if (!user) {
        return (
            <div className="flex items-center justify-center h-screen bg-bg-app">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-border-subtle border-t-text-secondary rounded-full animate-spin" />
                    <p className="text-sm text-text-muted">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    // The agent workspace is a single-rail surface: `ProjectSidebar` already
    // carries Work | Code, the nav rows and the account block, exactly like the
    // desktop shell. Rendering the app rail there duplicated every entry.
    const singleRailSurface = pathname === '/app/agent';

    // Authenticated - render app shell with sidebar
    return (
        <WorkspaceProvider>
            <div className="flex h-screen overflow-hidden">
                {!singleRailSurface && <Sidebar collapsed={sidebarCollapsed} />}
                <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                    <BreadcrumbOverridesProvider>
                        <AppHeaderCenterProvider>
                            <AppHeader
                                onToggleSidebar={singleRailSurface ? undefined : toggleSidebar}
                                sidebarCollapsed={sidebarCollapsed}
                            />
                            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-elegant">
                                {children}
                            </div>
                        </AppHeaderCenterProvider>
                    </BreadcrumbOverridesProvider>
                </main>
            </div>
        </WorkspaceProvider>
    );
}
