'use client';
// src/context/AuthContext.tsx
// React context provider for authentication state management using NextAuth
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';
import { AUTH_SESSION_INVALID_EVENT } from './authSessionEvents';

// Development auth bypass - set NEXT_PUBLIC_SKIP_AUTH=true in .env to skip authentication.
// Hard-gated on NODE_ENV for the same reason as AuthGuard: the flag is inlined
// into the client bundle, so it must never be honoured in a production build.
const SKIP_AUTH =
    process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production';

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
    /** Logged-in user: requires current password */
    changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
    updateProfile: (updates: {
        fullName?: string;
        email?: string;
        currentPassword?: string;
    }) => Promise<{ success: boolean; error?: string }>;
    refreshProfile: () => Promise<void>;
    resendConfirmation: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [userContext, setUserContext] = useState<UserContextType[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionRejected, setSessionRejected] = useState(false);
    const invalidatingSessionRef = useRef(false);

    // Use NextAuth session
    const { data: session, status, update: updateSession } = useSession();
    const hasSessionUser = Boolean(session?.user);

    const invalidateSession = useCallback(async () => {
        if (invalidatingSessionRef.current) {
            return;
        }

        invalidatingSessionRef.current = true;
        setSessionRejected(true);
        setProfile(null);
        setUserContext(null);

        try {
            await nextAuthSignOut({ redirect: false });
        } catch (err) {
            console.error('Error clearing invalid session:', err);
        } finally {
            invalidatingSessionRef.current = false;
        }
    }, []);

    // Fetch user profile from MongoDB via API
    const fetchProfile = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/me', { cache: 'no-store' });
            if (response.status === 401) {
                await invalidateSession();
                return false;
            }
            if (!response.ok) return false;

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
                setSessionRejected(false);
                return true;
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
        return false;
    }, [invalidateSession]);

    // User context is no longer stored (simplified architecture)
    const fetchUserContext = useCallback(async () => {
        setUserContext([]);
    }, []);

    // Refresh profile and context
    const refreshProfile = useCallback(async () => {
        const isAuthenticated = await fetchProfile();
        if (!isAuthenticated) {
            return;
        }

        await fetchUserContext();
    }, [fetchProfile, fetchUserContext]);

    // Initialize auth state
    useEffect(() => {
        if (SKIP_AUTH) {
            setLoading(false);
            return;
        }

        const initAuth = async () => {
            try {
                if (hasSessionUser) {
                    await refreshProfile();
                } else {
                    setProfile(null);
                    setUserContext(null);
                    setSessionRejected(false);
                }
            } catch (err) {
                console.error('Error initializing auth:', err);
            } finally {
                setLoading(false);
            }
        };

        void initAuth();
    }, [hasSessionUser, refreshProfile]);

    useEffect(() => {
        if (SKIP_AUTH) {
            return;
        }

        const handleSessionInvalid = () => {
            void invalidateSession();
        };

        window.addEventListener(AUTH_SESSION_INVALID_EVENT, handleSessionInvalid);
        return () => window.removeEventListener(AUTH_SESSION_INVALID_EVENT, handleSessionInvalid);
    }, [invalidateSession]);

    useEffect(() => {
        if (SKIP_AUTH || !hasSessionUser || sessionRejected) {
            return;
        }

        const revalidateSession = () => {
            void fetchProfile();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                revalidateSession();
            }
        };

        window.addEventListener('focus', revalidateSession);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', revalidateSession);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchProfile, hasSessionUser, sessionRejected]);

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
                const msg =
                    (typeof result?.error === 'string' && result.error) ||
                    (typeof result?.message === 'string' && result.message) ||
                    'Registration failed';
                return { success: false, error: msg };
            }

            // NextAuth doesn't require confirmation for credentials provider
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    // Sign in - uses NextAuth credentials provider
    const signIn = async (email: string, password: string, _rememberMe: boolean = true) => {
        try {
            const result = await nextAuthSignIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                return { success: false, error: 'Invalid credentials' };
            }

            setSessionRejected(false);
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
            setSessionRejected(false);
            setUserContext(null);
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

    const changePassword = async (currentPassword: string, newPassword: string) => {
        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                return {
                    success: false,
                    error:
                        (typeof result.error === 'string' && result.error) ||
                        (typeof result.message === 'string' && result.message) ||
                        'Failed to update password',
                };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const updateProfile = async (updates: {
        fullName?: string;
        email?: string;
        currentPassword?: string;
    }) => {
        try {
            const payload: Record<string, unknown> = {};
            if (updates.fullName !== undefined) {
                payload.fullName = updates.fullName;
            }
            if (updates.email !== undefined) {
                payload.email = updates.email;
            }
            if (updates.currentPassword !== undefined) {
                payload.currentPassword = updates.currentPassword;
            }

            const response = await fetch('/api/auth/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                return {
                    success: false,
                    error:
                        (typeof data.message === 'string' && data.message) ||
                        (typeof data.error === 'string' && data.error) ||
                        'Failed to update profile',
                };
            }

            if (updates.email && typeof updateSession === 'function') {
                const em = typeof data.profile?.email === 'string' ? data.profile.email : updates.email;
                const nm =
                    data.profile?.fullName !== undefined
                        ? data.profile.fullName
                        : updates.fullName !== undefined
                          ? updates.fullName
                          : session?.user?.name;
                await updateSession({ email: em, name: nm ?? null });
            }

            await refreshProfile();
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const resendConfirmation = async (_email: string) => {
        // NextAuth credentials provider doesn't have email confirmation
        // In a real implementation with email/password, you might want to add this
        return { success: true };
    };

    const value: AuthContextValue = {
        user: sessionRejected ? null : session?.user || null,
        session: session || null,
        profile,
        userContext,
        loading: status === 'loading' || loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        changePassword,
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
