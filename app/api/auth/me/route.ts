// app/api/auth/me/route.ts
// API route to get current user information
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/src/lib/supabase/supabaseServer';

export async function GET(request: Request) {
    try {
        const { client } = createRouteHandlerClient(request);

        const { data: { user }, error } = await client.auth.getUser();

        if (error || !user) {
            return NextResponse.json(
                { success: false, message: 'Not authenticated', user: null },
                { status: 401 }
            );
        }

        // Get user profile
        const { data: profile } = await client
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        // Get user context (groups, company, tenant)
        const { data: context } = await client
            .from('user_context')
            .select('*')
            .eq('user_id', user.id);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
            },
            profile,
            context,
        });
    } catch (err) {
        console.error('Get user error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
