'use client';
// src/components/ProtectedLayout.tsx
// Wrapper component that shows login if not authenticated
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

interface ProtectedLayoutProps {
    children: React.ReactNode;
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    // Show loading spinner while checking auth state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-bg-app">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-text-muted">Loading...</p>
                </div>
            </div>
        );
    }

    // Not authenticated - redirect to login
    if (!user) {
        // Use effect to avoid hydration issues
        React.useEffect(() => {
            router.push('/auth/login');
        }, [router]);

        return (
            <div className="flex items-center justify-center h-full bg-bg-app">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-text-muted">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    // Authenticated - render children
    return <>{children}</>;
}
