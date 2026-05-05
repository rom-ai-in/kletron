// src/services/authService.ts
// Core authentication service for NextAuth operations

interface SignUpData {
    email: string;
    password: string;
    fullName?: string;
}

interface SignInData {
    email: string;
    password: string;
}

interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    email_confirmed_at?: string | undefined;
    created_at: string;
    updated_at: string;
}

interface AuthResponse {
    success: boolean;
    message?: string;
    error?: string;
    user?: Partial<UserProfile>;
}

export class AuthService {
    /**
     * Register a new user with email and password
     */
    async signUp(data: SignUpData): Promise<AuthResponse> {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                    fullName: data.fullName || ''
                })
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: 'Registration failed',
                    error: result.error || 'Unknown error'
                };
            }

            return {
                success: true,
                message: 'Registration successful',
                user: {
                    id: result.user?.id,
                    email: result.user?.email || '',
                    email_confirmed_at: undefined, // NextAuth doesn't have this concept
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error'
            };
        }
    }

    /**
     * Sign in an existing user with email and password
     */
    async signIn(data: SignInData): Promise<AuthResponse> {
        try {
            const response = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password
                })
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: 'Sign in failed',
                    error: result.error || 'Unknown error'
                };
            }

            return {
                success: true,
                message: 'Sign in successful',
                user: {
                    id: result.user?.id,
                    email: result.user?.email || '',
                    email_confirmed_at: undefined,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error'
            };
        }
    }

    /**
     * Sign out the current user
     */
    async signOut(): Promise<AuthResponse> {
        try {
            const response = await fetch('/api/auth/json/signout', {
                method: 'POST'
            });

            if (!response.ok) {
                const result = await response.json();
                return {
                    success: false,
                    message: 'Sign out failed',
                    error: result.error || 'Unknown error'
                };
            }

            return {
                success: true,
                message: 'Sign out successful'
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error'
            };
        }
    }

    /**
     * Request a password reset email
     */
    async resetPassword(email: string): Promise<AuthResponse> {
        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                const result = await response.json();
                return {
                    success: false,
                    message: 'Password reset request failed',
                    error: result.error || 'Unknown error'
                };
            }

            return {
                success: true,
                message: 'Password reset email sent. Please check your inbox.'
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error'
            };
        }
    }

    /**
     * Complete password reset using the token from the reset link (?token= on /auth/update-password).
     */
    async completePasswordReset(token: string, newPassword: string): Promise<AuthResponse> {
        try {
            const response = await fetch('/api/auth/update-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                return {
                    success: false,
                    message: 'Password update failed',
                    error:
                        (typeof result.message === 'string' && result.message) ||
                        (typeof result.error === 'string' && result.error) ||
                        'Unknown error'
                };
            }

            return {
                success: true,
                message: 'Password updated successfully'
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error'
            };
        }
    }

    /**
     * Change password while signed in (requires current password).
     */
    async changePassword(currentPassword: string, newPassword: string): Promise<AuthResponse> {
        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                return {
                    success: false,
                    message: 'Password update failed',
                    error:
                        (typeof result.error === 'string' && result.error) ||
                        (typeof result.message === 'string' && result.message) ||
                        'Unknown error'
                };
            }

            return {
                success: true,
                message: 'Password updated successfully'
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error'
            };
        }
    }

    /**
     * Get the current authenticated user from NextAuth session
     */
    async getCurrentUser() {
        try {
            const response = await fetch('/api/auth/me');
            if (!response.ok) return null;

            const data = await response.json();
            if (!data.user) return null;

            return {
                id: data.user.id,
                email: data.user.email || '',
                email_confirmed_at: undefined, // NextAuth doesn't track this
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
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
            if (!data.user) return null;

            return {
                id: data.user.id,
                full_name: data.user.name || null,
                email: data.user.email,
                avatar_url: null, // Will need to be handled separately
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        } catch {
            return null;
        }
    }

    /**
     * Get user context (deprecated - returns empty array in MongoDB architecture)
     */
    async getUserContext(): Promise<[]> {
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
                body: JSON.stringify({
                    name: updates.full_name ?? null
                })
            });

            if (!response.ok) {
                const data = await response.json();
                return {
                    success: false,
                    message: 'Profile update failed',
                    error: data.error || 'Unknown error'
                };
            }

            return {
                success: true,
                message: 'Profile updated successfully'
            };
        } catch (err) {
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: err instanceof Error ? err.message : 'Unknown error'
            };
        }
    }
}

// Export singleton instance
export const authService = new AuthService();