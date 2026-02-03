// src/services/authService.ts
// Core authentication service for Supabase auth operations
import { getSupabaseClient } from '../lib/supabase/supabaseClient';
import type { SignUpData, SignInData, AuthResponse, UserProfile, UserContext } from '../lib/supabase/types';

export class AuthService {
    private supabase = getSupabaseClient();

    /**
     * Register a new user with email and password
     */
    async signUp(data: SignUpData): Promise<AuthResponse> {
        try {
            const { data: authData, error } = await this.supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        full_name: data.fullName || '',
                    },
                },
            });

            if (error) {
                return {
                    success: false,
                    message: 'Registration failed',
                    error: error.message,
                };
            }

            if (!authData.user) {
                return {
                    success: false,
                    message: 'Registration failed',
                    error: 'No user returned from signup',
                };
            }

            return {
                success: true,
                message: 'Registration successful',
                user: {
                    id: authData.user.id,
                    email: authData.user.email || '',
                    email_confirmed_at: authData.user.email_confirmed_at || undefined,
                    created_at: authData.user.created_at,
                    updated_at: authData.user.updated_at || authData.user.created_at,
                },
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }

    /**
     * Sign in an existing user with email and password
     */
    async signIn(data: SignInData): Promise<AuthResponse> {
        try {
            const { data: authData, error } = await this.supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });

            if (error) {
                return {
                    success: false,
                    message: 'Sign in failed',
                    error: error.message,
                };
            }

            if (!authData.user) {
                return {
                    success: false,
                    message: 'Sign in failed',
                    error: 'No user returned from sign in',
                };
            }

            return {
                success: true,
                message: 'Sign in successful',
                user: {
                    id: authData.user.id,
                    email: authData.user.email || '',
                    email_confirmed_at: authData.user.email_confirmed_at || undefined,
                    created_at: authData.user.created_at,
                    updated_at: authData.user.updated_at || authData.user.created_at,
                },
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }

    /**
     * Sign out the current user
     */
    async signOut(): Promise<AuthResponse> {
        try {
            const { error } = await this.supabase.auth.signOut();

            if (error) {
                return {
                    success: false,
                    message: 'Sign out failed',
                    error: error.message,
                };
            }

            return {
                success: true,
                message: 'Sign out successful',
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }

    /**
     * Request a password reset email
     */
    async resetPassword(email: string): Promise<AuthResponse> {
        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/update-password`,
            });

            if (error) {
                return {
                    success: false,
                    message: 'Password reset request failed',
                    error: error.message,
                };
            }

            return {
                success: true,
                message: 'Password reset email sent. Please check your inbox.',
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }

    /**
     * Update password (after clicking reset link)
     */
    async updatePassword(newPassword: string): Promise<AuthResponse> {
        try {
            const { error } = await this.supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                return {
                    success: false,
                    message: 'Password update failed',
                    error: error.message,
                };
            }

            return {
                success: true,
                message: 'Password updated successfully',
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }

    /**
     * Get the current authenticated user
     */
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();

            if (error || !user) {
                return null;
            }

            return {
                id: user.id,
                email: user.email || '',
                email_confirmed_at: user.email_confirmed_at || undefined,
                created_at: user.created_at,
                updated_at: user.updated_at || user.created_at,
            };
        } catch {
            return null;
        }
    }

    /**
     * Get the current user's profile from MongoDB via API
     */
    async getUserProfile(): Promise<UserProfile | null> {
        try {
            const response = await fetch('/api/auth/me');
            if (!response.ok) return null;

            const data = await response.json();
            if (!data.success || !data.profile) return null;

            return {
                id: data.profile.id,
                full_name: data.profile.fullName,
                email: data.profile.email,
                avatar_url: null,
                created_at: data.profile.createdAt,
                updated_at: data.profile.updatedAt,
            };
        } catch {
            return null;
        }
    }

    /**
     * Get user context (deprecated - returns empty array in MongoDB architecture)
     */
    async getUserContext(): Promise<UserContext[] | null> {
        // Context is not used in the MongoDB-only architecture
        return [];
    }

    /**
     * Update user profile via API
     */
    async updateProfile(updates: Partial<Pick<UserProfile, 'full_name' | 'avatar_url'>>): Promise<AuthResponse> {
        try {
            const response = await fetch('/api/auth/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: updates.full_name ?? null }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                return {
                    success: false,
                    message: 'Profile update failed',
                    error: data.message || 'Unknown error',
                };
            }

            return {
                success: true,
                message: 'Profile updated successfully',
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }

    /**
     * Listen to auth state changes
     */
    onAuthStateChange(callback: (event: string, session: unknown) => void) {
        return this.supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }
}

// Export singleton instance
export const authService = new AuthService();
