import { SignJWT } from 'jose';
import { randomBytes } from 'crypto';

import { requireIdeTokenSecret } from './ideTokenSecret';

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

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
    // Resolved per call, and throws when unconfigured: a token signed with a
    // key the verifier will not accept is worse than a clear failure.
    const ideJwtSecret = requireIdeTokenSecret();
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
        .sign(ideJwtSecret);

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
        .sign(ideJwtSecret);

    return {
        accessToken,
        refreshToken,
        expiresAt: accessTokenExpiry * 1000,
        user
    };
}
