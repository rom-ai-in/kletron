// src/lib/supabase/supabaseServer.ts
// Server-side Supabase client for API routes and server components
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        );
    }

    const cookieStore = await cookies();

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get(name: string) {
                return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: CookieOptions) {
                try {
                    cookieStore.set({ name, value, ...options });
                } catch {
                    // Handle cookies in middleware/server components where setting isn't possible
                }
            },
            remove(name: string, options: CookieOptions) {
                try {
                    cookieStore.set({ name, value: '', ...options });
                } catch {
                    // Handle cookies in middleware/server components where setting isn't possible
                }
            },
        },
    });
}

// For API route handlers - accepts cookies from request
export function createRouteHandlerClient(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        );
    }

    // Extract cookies from request
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMap = new Map<string, string>();

    cookieHeader.split(';').forEach((cookie) => {
        const [key, value] = cookie.split('=').map((s) => s.trim());
        if (key && value) {
            cookieMap.set(key, value);
        }
    });

    const responseCookies: { name: string; value: string; options: CookieOptions }[] = [];

    return {
        client: createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieMap.get(name);
                },
                set(name: string, value: string, options: CookieOptions) {
                    responseCookies.push({ name, value, options });
                },
                remove(name: string, options: CookieOptions) {
                    responseCookies.push({ name, value: '', options: { ...options, maxAge: 0 } });
                },
            },
        }),
        getResponseCookies() {
            return responseCookies;
        },
    };
}

