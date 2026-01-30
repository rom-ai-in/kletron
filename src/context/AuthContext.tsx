'use client';
// src/context/AuthContext.tsx
// React context provider for authentication state management
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabaseClient, setRememberMePreference } from '../lib/supabase/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile, UserContext as UserContextType } from '../lib/supabase/types';

// Development auth bypass - set NEXT_PUBLIC_SKIP_AUTH=true in .env to skip authentication
const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

interface AuthContextValue {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    userContext: UserContextType[] | null;
    loading: boolean;
    signUp: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
    signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<{ success: boolean; error?: string }>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [userContext, setUserContext] = useState<UserContextType[] | null>(null);
    const [loading, setLoading] = useState(true);

    const supabase = getSupabaseClient();

    // Fetch user profile
    const fetchProfile = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (!error && data) {
                setProfile(data);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    }, [supabase]);

    // Fetch user context (groups, company, tenant)
    const fetchUserContext = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_context')
                .select('*')
                .eq('user_id', userId);

            if (!error && data) {
                setUserContext(data);
            }
        } catch (err) {
            console.error('Error fetching user context:', err);
        }
    }, [supabase]);

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
            async (event, newSession) => {
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
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName || '' },
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

    // Sign in
    const signIn = async (email: string, password: string, rememberMe: boolean = true) => {
        try {
            // Save the remember me preference before signing in
            setRememberMePreference(rememberMe);

            const { error } = await supabase.auth.signInWithPassword({
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
        refreshProfile,
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
