// src/lib/supabase/supabaseClient.ts
// Browser-side Supabase client for client components
import { createBrowserClient } from '@supabase/ssr';

const REMEMBER_ME_KEY = 'supabase-remember-me';
const SUPABASE_STORAGE_PREFIXES = ['supabase', 'sb-'];

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
    migrateSupabaseStorage(rememberMe);
    localStorage.setItem(REMEMBER_ME_KEY, String(rememberMe));
}

/**
 * Clear all Supabase session data from storage
 * Used when user logs out with "remember me" unchecked
 */
export function clearSessionStorage(): void {
    if (typeof window === 'undefined') return;
    clearSupabaseStorage(localStorage);
    clearSupabaseStorage(sessionStorage);
}

function isSupabaseKey(key: string | null) {
    if (!key) return false;
    return SUPABASE_STORAGE_PREFIXES.some(prefix => key.includes(prefix));
}

function collectSupabaseKeys(storage: Storage): string[] {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (isSupabaseKey(key)) {
            keys.push(key as string);
        }
    }
    return keys;
}

function clearSupabaseStorage(storage: Storage): void {
    const keysToRemove = collectSupabaseKeys(storage);
    keysToRemove.forEach(key => storage.removeItem(key));
}

function migrateSupabaseStorage(rememberMe: boolean): void {
    if (typeof window === 'undefined') return;
    const source = rememberMe ? sessionStorage : localStorage;
    const target = rememberMe ? localStorage : sessionStorage;
    const keysToMove = collectSupabaseKeys(source);

    keysToMove.forEach(key => {
        const value = source.getItem(key);
        if (value !== null) {
            target.setItem(key, value);
        }
        source.removeItem(key);
    });
}

const supabaseStorage = {
    getItem(key: string) {
        if (typeof window === 'undefined') return null;
        const storage = getRememberMePreference() ? localStorage : sessionStorage;
        return storage.getItem(key);
    },
    setItem(key: string, value: string) {
        if (typeof window === 'undefined') return;
        const storage = getRememberMePreference() ? localStorage : sessionStorage;
        storage.setItem(key, value);
    },
    removeItem(key: string) {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },
};

let currentRememberMe: boolean | null = null;

export function createClient(rememberMe: boolean = getRememberMePreference()) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        );
    }

    currentRememberMe = rememberMe;

    return createBrowserClient(supabaseUrl, supabaseAnonKey, {
        cookieOptions: rememberMe
            ? {
                // 30 days for persistent sessions
                maxAge: 60 * 60 * 24 * 30,
            }
            : {},
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            storage: supabaseStorage,
        },
    });
}

// Singleton instance for client-side usage
let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient(rememberMe?: boolean) {
    const desiredRememberMe = rememberMe ?? getRememberMePreference();
    if (!browserClient || currentRememberMe !== desiredRememberMe) {
        browserClient = createClient(desiredRememberMe);
    }
    return browserClient;
}

/**
 * Reset the Supabase client instance
 */
export function resetSupabaseClient(): void {
    browserClient = null;
    currentRememberMe = null;
}

