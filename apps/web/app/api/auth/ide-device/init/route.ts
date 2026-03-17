import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createIdeDeviceSession, getDeviceByUserCode } from '@kletron/server/services/ideDeviceService';

const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;
const POLL_INTERVAL_SECONDS = 5;

function generateUserCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(6);
    let code = '';
    for (const b of bytes) {
        code += alphabet[b % alphabet.length];
    }
    return code.match(/.{1,4}/g)?.join('-') || code;
}

export async function POST(request: NextRequest) {
    try {
        let userCode = generateUserCode();
        let attempts = 0;
        while (attempts < 5) {
            const existing = await getDeviceByUserCode(userCode);
            if (!existing) break;
            userCode = generateUserCode();
            attempts += 1;
        }

        const deviceCode = randomBytes(24).toString('hex');
        const now = Date.now();
        const expiresAt = new Date(now + DEVICE_CODE_TTL_MS);

        await createIdeDeviceSession({
            deviceCode,
            userCode,
            createdAt: new Date(now),
            expiresAt,
        });

        const origin = request.nextUrl.origin;
        return NextResponse.json({
            success: true,
            deviceCode,
            userCode,
            verificationUri: `${new URL('/auth/ide-device', origin).toString()}`,
            verificationUriComplete: `${new URL(`/auth/ide-device?userCode=${encodeURIComponent(userCode)}`, origin).toString()}`,
            expiresAt: expiresAt.getTime(),
            interval: POLL_INTERVAL_SECONDS,
        });
    } catch (error) {
        console.error('[IDE Device] Error initializing device flow:', error);
        return NextResponse.json({ success: false, error: 'Failed to start device flow' }, { status: 500 });
    }
}
