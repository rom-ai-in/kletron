'use client';
// src/components/AppShell.tsx
// Main app shell that shows sidebar/header for authenticated users or redirects to login
import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { BreadcrumbOverridesProvider } from './ui/BreadcrumbOverridesProvider';

interface AppShellProps {
    children: React.ReactNode;
}

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/auth/reset-password', '/auth/update-password'];

// Development auth bypass
const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

export function AppShell({ children }: AppShellProps) {
    const { user, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    // Check if current route is public
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

    // Redirect to login if not authenticated (must be at top level, not inside conditional)
    useEffect(() => {
        if (!SKIP_AUTH && !loading && !user && !isPublicRoute) {
            router.push('/auth/login');
        }
    }, [user, loading, isPublicRoute, router]);

    // For public routes (auth pages), render without shell
    if (isPublicRoute) {
        return <>{children}</>;
    }

    // Dev mode: skip auth checks entirely
    if (SKIP_AUTH) {
        return (
            <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                    <BreadcrumbOverridesProvider>
                        <AppHeader />
                        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
                    </BreadcrumbOverridesProvider>
                </main>
            </div>
        );
    }

    // Show loading spinner while checking auth
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

    // Not authenticated and not on public route - show redirect spinner
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

    // Authenticated - render full app shell with sidebar and header
    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                <BreadcrumbOverridesProvider>
                    <AppHeader />
                    <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
                </BreadcrumbOverridesProvider>
            </main>
        </div>
    );
}

