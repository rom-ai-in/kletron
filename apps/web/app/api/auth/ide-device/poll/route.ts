import { NextRequest, NextResponse } from 'next/server';
import { consumeDeviceSession, getDeviceByDeviceCode } from '@kletron/server/services/ideDeviceService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const deviceCode = request.nextUrl.searchParams.get('deviceCode');
        if (!deviceCode) {
            return NextResponse.json({ success: false, error: 'Missing deviceCode' }, { status: 400 });
        }

        const session = await getDeviceByDeviceCode(deviceCode);
        if (!session) {
            return NextResponse.json({ success: false, pending: true });
        }

        if (!session.accessToken || !session.refreshToken || !session.tokenExpiresAt || !session.user) {
            return NextResponse.json({ success: false, pending: true });
        }

        const consumed = await consumeDeviceSession(deviceCode);
        if (!consumed || !consumed.accessToken || !consumed.refreshToken || !consumed.tokenExpiresAt || !consumed.user) {
            return NextResponse.json({ success: false, pending: true });
        }

        return NextResponse.json({
            success: true,
            accessToken: consumed.accessToken,
            refreshToken: consumed.refreshToken,
            expiresAt: consumed.tokenExpiresAt,
            user: consumed.user,
        });
    } catch (error) {
        console.error('[IDE Device] Poll error:', error);
        return NextResponse.json({ success: false, error: 'Failed to poll device flow' }, { status: 500 });
    }
}
