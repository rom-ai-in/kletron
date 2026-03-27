'use client';
// src/context/AuthContext.tsx
// React context provider for authentication state management
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { clearSessionStorage, getSupabaseClient, resetSupabaseClient, setRememberMePreference } from '@kletron/ui/lib/supabase/supabaseClient';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import type { UserProfile, UserContext as UserContextType } from '@kletron/shared/supabase/types';

// Development auth bypass - set NEXT_PUBLIC_SKIP_AUTH=true in .env to skip authentication
const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

interface AuthContextValue {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    userContext: UserContextType[] | null;
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
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [userContext, setUserContext] = useState<UserContextType[] | null>(null);
    const [loading, setLoading] = useState(true);

    const [supabase, setSupabase] = useState(() => getSupabaseClient());

    // Track in-flight and already-fetched user IDs to prevent duplicate calls
    const fetchingRef = useRef<string | null>(null);
    const fetchedRef = useRef<string | null>(null);

    // Fetch user profile from MongoDB via API
    const fetchProfile = useCallback(async (userId: string) => {
        // Deduplicate: skip if already fetched for this user or a fetch is in-flight
        if (fetchedRef.current === userId || fetchingRef.current === userId) return;
        fetchingRef.current = userId;
        try {
            const response = await fetch('/api/auth/me');
            if (!response.ok) {
                console.error('Failed to fetch profile:', response.statusText);
                // Mark as fetched even on HTTP error to prevent retry flood
                fetchedRef.current = userId;
                return;
            }
            const data = await response.json();
            if (data.success && data.profile) {
                setProfile({
                    id: data.profile.id,
                    full_name: data.profile.fullName,
                    email: data.profile.email,
                    avatar_url: null,
                    created_at: data.profile.createdAt,
                    updated_at: data.profile.updatedAt,
                });
            }
            // Always mark as fetched after a successful HTTP response,
            // even if profile is null — prevents retry loop on auth state changes
            fetchedRef.current = userId;
        } catch (err) {
            console.error('Error fetching profile:', err);
            // Only skip marking on network errors to allow genuine retries
        } finally {
            fetchingRef.current = null;
        }
    }, []);

    // User context is no longer stored (simplified architecture)
    const fetchUserContext = useCallback(async (_userId: string) => {
        // Context is not used in the MongoDB-only architecture
        setUserContext([]);
    }, []);

    // Refresh profile and context
    const refreshProfile = useCallback(async () => {
        if (user) {
            await Promise.all([
                fetchProfile(user.id),
                fetchUserContext(user.id),
            ]);
        }
    }, [user, fetchProfile, fetchUserContext]);

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            // Skip auth initialization in dev mode
            if (SKIP_AUTH) {
                setLoading(false);
                return;
            }

            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();

                if (currentSession) {
                    setSession(currentSession);
                    setUser(currentSession.user);
                    await Promise.all([
                        fetchProfile(currentSession.user.id),
                        fetchUserContext(currentSession.user.id),
                    ]);
                }
            } catch (err) {
                console.error('Error initializing auth:', err);
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        // Skip auth listener in dev mode
        if (SKIP_AUTH) {
            return;
        }

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event: AuthChangeEvent, newSession: Session | null) => {
                setSession(newSession);
                setUser(newSession?.user ?? null);

                if (newSession?.user) {
                    await Promise.all([
                        fetchProfile(newSession.user.id),
                        fetchUserContext(newSession.user.id),
                    ]);
                } else {
                    setProfile(null);
                    setUserContext(null);
                }

                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase, fetchProfile, fetchUserContext]);

    // Sign up
    const signUp = async (email: string, password: string, fullName?: string) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName || '' },
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) {
                return { success: false, error: error.message };
            }

            // Email confirmation is required - no session returned
            if (data.user && !data.session) {
                return {
                    success: true,
                    requiresConfirmation: true,
                };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    // Sign in
    const signIn = async (email: string, password: string, rememberMe: boolean = true) => {
        try {
            // Save the remember me preference before signing in
            setRememberMePreference(rememberMe);
            resetSupabaseClient();
            const client = getSupabaseClient(rememberMe);
            setSupabase(client);

            const { error } = await client.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    // Sign out
    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();

            if (error) {
                return { success: false, error: error.message };
            }

            // Reset dedup refs so re-login triggers a fresh fetch
            fetchedRef.current = null;
            fetchingRef.current = null;

            clearSessionStorage();
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    // Reset password
    const resetPassword = async (email: string) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/update-password`,
            });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    // Update password
    const updatePassword = async (newPassword: string) => {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const updateProfile = async (updates: { fullName?: string }) => {
        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const response = await fetch('/api/auth/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: updates.fullName ?? null }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                return { success: false, error: data.message || 'Failed to update profile' };
            }

            await refreshProfile();
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const resendConfirmation = async (email: string) => {
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    const value: AuthContextValue = {
        user,
        session,
        profile,
        userContext,
        loading,
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
