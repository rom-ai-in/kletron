'use client';
// app/app/layout.tsx
// Layout for authenticated /app/* pages with Sidebar
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@numezis/ui/context/AuthContext';
import { WorkspaceProvider } from '@numezis/ui/context/WorkspaceContext';
import { Sidebar } from '@numezis/ui/components/Sidebar';
import { AppHeader } from '@numezis/ui/components/AppHeader';
import { BreadcrumbOverridesProvider } from '@numezis/ui/components/ui/BreadcrumbOverridesProvider';

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login');
        }
    }, [user, loading, router]);

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

    // Authenticated - render app shell with sidebar
    return (
        <WorkspaceProvider>
            <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                    <BreadcrumbOverridesProvider>
                        <AppHeader />
                        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
                    </BreadcrumbOverridesProvider>
                </main>
            </div>
        </WorkspaceProvider>
    );
}
