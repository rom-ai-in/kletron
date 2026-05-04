import { NextRequest, NextResponse } from 'next/server';
import { generateIdeTokens } from '@kletron/server/lib/auth/ideTokens';
import { getDeviceByUserCode, updateDeviceSession } from '@kletron/server/services/ideDeviceService';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAppRouteAuth(request);
        if (!auth) {
            return NextResponse.json({ success: false, error: 'Not authenticated. Please login first.' }, { status: 401 });
        }

        const body = await request.json();
        const rawCode = String(body?.userCode || '').trim().toUpperCase();
        const normalized = rawCode.replace(/[^A-Z0-9]/g, '');
        const userCode = normalized.length > 4
            ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
            : normalized;
        if (!userCode) {
            return NextResponse.json({ success: false, error: 'Missing userCode' }, { status: 400 });
        }

        const session = await getDeviceByUserCode(userCode);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Invalid or expired code' }, { status: 404 });
        }

        const fullName = null;

        const tokenResult = await generateIdeTokens({
            id: auth.userId,
            email: '',
            fullName,
        });

        await updateDeviceSession(session.deviceCode, {
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
            tokenExpiresAt: tokenResult.expiresAt,
            user: tokenResult.user,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[IDE Device] Complete error:', error);
        return NextResponse.json({ success: false, error: 'Failed to complete device flow' }, { status: 500 });
    }
}
