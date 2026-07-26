// Signing key for IDE access/refresh tokens.
//
// This module exists so the minting side (ideTokens.ts) and the verifying side
// (apiAuth.ts) can never disagree about the key, and so no key material is
// committed to the repository.
//
// Previously both files defaulted to the literal
// 'ide-secret-key-change-in-production'. Anyone with a copy of the source could
// mint a token for an arbitrary `sub` and authenticate as any user.
//
// Resolution order:
//   1. IDE_JWT_SECRET — the only supported production configuration.
//   2. Outside production, a value derived from NEXTAUTH_SECRET. Installation
//      specific and never published, so local IDE sign-in keeps working without
//      shipping a shared constant.
//   3. Nothing — IDE tokens are disabled: verification refuses every token and
//      minting throws instead of issuing one signed with a guessable key.

import { createHash } from 'node:crypto';

const MIN_SECRET_LENGTH = 16;

function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

/** Derived dev key — distinct domain separator so it can never collide with session JWTs. */
function deriveFromNextAuthSecret(secret: string): Uint8Array {
    return createHash('sha256').update(`kletron-ide-token:${secret}`).digest();
}

/**
 * The signing key, or null when IDE tokens are not configured.
 * Callers must treat null as "feature disabled", never as "use a default".
 */
export function resolveIdeTokenSecret(): Uint8Array | null {
    const explicit = process.env.IDE_JWT_SECRET?.trim();
    if (explicit) {
        if (explicit.length < MIN_SECRET_LENGTH) {
            throw new Error(
                `IDE_JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${explicit.length}).`
            );
        }
        return new TextEncoder().encode(explicit);
    }

    if (!isProduction()) {
        const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();
        if (nextAuthSecret) {
            return deriveFromNextAuthSecret(nextAuthSecret);
        }
    }

    return null;
}

export function areIdeTokensEnabled(): boolean {
    return resolveIdeTokenSecret() !== null;
}

/**
 * The signing key, or a thrown error explaining what to configure.
 * Used by the minting path: issuing an unverifiable token is worse than failing.
 */
export function requireIdeTokenSecret(): Uint8Array {
    const secret = resolveIdeTokenSecret();
    if (!secret) {
        throw new Error(
            'IDE token authentication is not configured. Set IDE_JWT_SECRET ' +
                '(e.g. `openssl rand -hex 32`) to enable IDE sign-in.'
        );
    }
    return secret;
}
