// src/lib/supabase/supabasePages.ts
// Supabase server client for Next.js pages API routes
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextApiRequest } from 'next';
import type { Database } from './types';

export function createPagesSupabaseClient(req: NextApiRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        );
    }

    return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get(name: string) {
                return req.cookies[name];
            },
            set(name: string, value: string, options: CookieOptions) {
                // No-op for pages API auth checks; cookie writes are not needed here
                void name;
                void value;
                void options;
            },
            remove(name: string, options: CookieOptions) {
                // No-op for pages API auth checks; cookie writes are not needed here
                void name;
                void options;
            },
        },
    });
}
