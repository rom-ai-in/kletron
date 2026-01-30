// src/lib/supabase/supabaseClient.ts
// Browser-side Supabase client for client components
import { createBrowserClient } from '@supabase/ssr';

const REMEMBER_ME_KEY = 'supabase-remember-me';

/**
 * Get the current "remember me" preference from localStorage
 * Defaults to true if not set
 */
export function getRememberMePreference(): boolean {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(REMEMBER_ME_KEY);
    return stored === null ? true : stored === 'true';
}

/**
 * Set the "remember me" preference in localStorage
 */
export function setRememberMePreference(rememberMe: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(REMEMBER_ME_KEY, String(rememberMe));
}

/**
 * Clear all Supabase session data from storage
 * Used when user logs out with "remember me" unchecked
 */
export function clearSessionStorage(): void {
    if (typeof window === 'undefined') return;
    // Clear any Supabase-related items from both storages
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        );
    }

    return createBrowserClient(supabaseUrl, supabaseAnonKey, {
        cookieOptions: {
            // 30 days for persistent sessions
            maxAge: 60 * 60 * 24 * 30,
        },
    });
}

// Singleton instance for client-side usage
let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
    if (!browserClient) {
        browserClient = createClient();
    }
    return browserClient;
}

/**
 * Reset the Supabase client instance
 */
export function resetSupabaseClient(): void {
    browserClient = null;
}


