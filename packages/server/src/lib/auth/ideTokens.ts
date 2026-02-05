import { SignJWT } from 'jose';
import { randomBytes } from 'crypto';

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

const IDE_JWT_SECRET = new TextEncoder().encode(
    process.env.IDE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'ide-secret-key-change-in-production'
);

export interface IdeTokenUser {
    id: string;
    email: string;
    fullName: string | null;
}

export interface IdeTokenResult {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: IdeTokenUser;
}

export async function generateIdeTokens(user: IdeTokenUser): Promise<IdeTokenResult> {
    const now = Math.floor(Date.now() / 1000);
    const accessTokenExpiry = now + 60 * 60;

    const accessToken = await new SignJWT({
        sub: user.id,
        email: user.email,
        type: 'ide_access',
        iat: now,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(ACCESS_TOKEN_EXPIRY)
        .setIssuedAt()
        .sign(IDE_JWT_SECRET);

    const refreshTokenId = randomBytes(16).toString('hex');
    const refreshToken = await new SignJWT({
        sub: user.id,
        jti: refreshTokenId,
        type: 'ide_refresh',
        iat: now,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(REFRESH_TOKEN_EXPIRY)
        .setIssuedAt()
        .sign(IDE_JWT_SECRET);

    return {
        accessToken,
        refreshToken,
        expiresAt: accessTokenExpiry * 1000,
        user
    };
}
