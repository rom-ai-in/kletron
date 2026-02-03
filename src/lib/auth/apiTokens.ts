// src/lib/auth/apiTokens.ts
// Helper utilities for API tokens (extension sync)
import crypto from 'node:crypto';

export const API_TOKEN_PREFIX = 'nc_';

export function createRawApiToken(): string {
    return `${API_TOKEN_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
}

export function hashApiToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}
