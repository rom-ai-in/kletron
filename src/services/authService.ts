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
     * Get the current user's profile
     */
    async getUserProfile(): Promise<UserProfile | null> {
        try {
            const user = await this.getCurrentUser();
            if (!user) return null;

            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error || !data) {
                return null;
            }

            return data;
        } catch {
            return null;
        }
    }

    /**
     * Get user context with tenant, company, and groups
     */
    async getUserContext(): Promise<UserContext[] | null> {
        try {
            const user = await this.getCurrentUser();
            if (!user) return null;

            const { data, error } = await this.supabase
                .from('user_context')
                .select('*')
                .eq('user_id', user.id);

            if (error || !data) {
                return null;
            }

            return data;
        } catch {
            return null;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(updates: Partial<Pick<UserProfile, 'full_name' | 'avatar_url'>>): Promise<AuthResponse> {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                return {
                    success: false,
                    message: 'Not authenticated',
                    error: 'User not logged in',
                };
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await this.supabase
                .from('user_profiles')
                .update(updates as any)
                .eq('id', user.id);

            if (error) {
                return {
                    success: false,
                    message: 'Profile update failed',
                    error: error.message,
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
