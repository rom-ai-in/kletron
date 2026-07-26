'use client';
// src/components/AuthGuard.tsx
// Higher-order component to protect routes requiring authentication
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

// Development auth bypass - set NEXT_PUBLIC_SKIP_AUTH=true in .env to skip authentication.
// Hard-gated on NODE_ENV: this value is inlined into the client bundle at build
// time, so a production build made with the flag left on would ship an
// unprotected UI to every visitor.
const SKIP_AUTH =
    process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production';

interface AuthGuardProps {
    children: React.ReactNode;
    redirectTo?: string;
}

export function AuthGuard({ children, redirectTo = '/auth/login' }: AuthGuardProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!SKIP_AUTH && !loading && !user) {
            router.push(redirectTo);
        }
    }, [user, loading, router, redirectTo]);

    // Dev mode: skip auth when NEXT_PUBLIC_SKIP_AUTH is true
    if (SKIP_AUTH) {
        return <>{children}</>;
    }

    // Show loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-status-success border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-text-muted">Loading...</p>
                </div>
            </div>
        );
    }

    // Not authenticated - will redirect
    if (!user) {
        return null;
    }

    // Authenticated - render children
    return <>{children}</>;
}

// HOC version for wrapping pages
export function withAuth<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    redirectTo?: string
) {
    const WithAuthComponent = (props: P) => {
        return (
            <AuthGuard redirectTo={redirectTo}>
                <WrappedComponent {...props} />
            </AuthGuard>
        );
    };

    WithAuthComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

    return WithAuthComponent;
}
