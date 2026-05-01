'use client';
// src/context/AuthContext.tsx
// React context provider for authentication state management using NextAuth
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';

// Development auth bypass - set NEXT_PUBLIC_SKIP_AUTH=true in .env to skip authentication
const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}

interface UserContext {
    tenant_id: string;
    company_id: string;
    group_id: string;
    group_role: string;
}

type UserContextType = UserContext;

interface AuthContextValue {
    user: any | null;
    session: any | null;
    profile: UserProfile | null;
    userContext: UserContext[] | null;
    loading: boolean;
    signUp: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string; requiresConfirmation?: boolean }>;
    signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<{ success: boolean; error?: string }>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
    updateProfile: (updates: { fullName?: string }) => Promise<{ success: boolean; error?: string }>;
    refreshProfile: () => Promise<void>;
    resendConfirmation: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [userContext, setUserContext] = useState<UserContextType[] | null>(null);
    const [loading, setLoading] = useState(true);

    // Use NextAuth session
    const { data: session, status } = useSession();

    // Fetch user profile from MongoDB via API
    const fetchProfile = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/me');
            if (!response.ok) return;

            const data = await response.json();
            if (data.success && data.user) {
                setProfile({
                    id: data.user.id,
                    full_name: data.user.name || null,
                    email: data.user.email,
                    avatar_url: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    }, []);

    // User context is no longer stored (simplified architecture)
    const fetchUserContext = useCallback(async () => {
        setUserContext([]);
    }, []);

    // Refresh profile and context
    const refreshProfile = useCallback(async () => {
        await Promise.all([
            fetchProfile(),
            fetchUserContext(),
        ]);
    }, [fetchProfile, fetchUserContext]);

    // Initialize auth state
    useEffect(() => {
        if (SKIP_AUTH) {
            setLoading(false);
            return;
        }

        const initAuth = async () => {
            try {
                if (session?.user) {
                    await refreshProfile();
                }
            } catch (err) {
                console.error('Error initializing auth:', err);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, [session, refreshProfile]);

    // Sign up - calls our custom API route which will handle NextAuth registration
    const signUp = async (email: string, password: string, fullName?: string) => {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, fullName })
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, error: result.error || 'Registration failed' };
            }

            // NextAuth doesn't require confirmation for credentials provider
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    // Sign in - uses NextAuth credentials provider
    const signIn = async (email: string, password: string, rememberMe: boolean = true) => {
        try {
            const result = await nextAuthSignIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                return { success: false, error: 'Invalid credentials' };
            }

            // Refresh profile after successful sign in
            await refreshProfile();

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    // Sign out - uses NextAuth signOut
    const signOut = async () => {
        try {
            await nextAuthSignOut({ redirect: false });
            setProfile(null);
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    // Reset password - calls our custom API route
    const resetPassword = async (email: string) => {
        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                const result = await response.json();
                return { success: false, error: result.error || 'Failed to send reset email' };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    // Update password - calls our custom API route
    const updatePassword = async (newPassword: string) => {
        try {
            const response = await fetch('/api/auth/update-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword })
            });

            if (!response.ok) {
                const result = await response.json();
                return { success: false, error: result.error || 'Failed to update password' };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const updateProfile = async (updates: { fullName?: string }) => {
        try {
            const response = await fetch('/api/auth/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: updates.fullName ?? null })
            });

            if (!response.ok) {
                const data = await response.json();
                return { success: false, error: data.error || 'Failed to update profile' };
            }

            await refreshProfile();
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const resendConfirmation = async (email: string) => {
        // NextAuth credentials provider doesn't have email confirmation
        // In a real implementation with email/password, you might want to add this
        return { success: true };
    };

    const value: AuthContextValue = {
        user: session?.user || null,
        session: session || null,
        profile,
        userContext,
        loading: status === 'loading' || loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        updateProfile,
        refreshProfile,
        resendConfirmation,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}