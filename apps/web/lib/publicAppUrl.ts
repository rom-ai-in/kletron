const DEFAULT_PUBLIC_APP_ORIGIN = "https://www.kletron.com";
const PLACEHOLDER_ORIGIN_MARKER = "change-me-after-first-deploy.run.app";

function normalizeOriginCandidate(raw: string | undefined): string {
    const trimmed = raw?.trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    try {
        return new URL(trimmed).origin;
    } catch {
        return "";
    }
}

function isLocalDevOrigin(origin: string): boolean {
    return /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$/i.test(origin);
}

function isPlaceholderOrigin(origin: string): boolean {
    return origin.includes(PLACEHOLDER_ORIGIN_MARKER);
}

/**
 * Canonical public origin for browser redirects and OAuth redirect_uri values.
 *
 * Prefer the deployed public URL from env, but fall back to the request origin
 * for local dev only. If the env is still set to the first-deploy placeholder,
 * ignore it so production keeps using the real public origin.
 */
export function getPublicAppOrigin(request?: Request): string {
    const envOrigin =
        normalizeOriginCandidate(process.env.NEXT_PUBLIC_APP_URL) ||
        normalizeOriginCandidate(process.env.NEXTAUTH_URL);
    if (envOrigin && !isPlaceholderOrigin(envOrigin)) {
        return envOrigin;
    }

    if (request) {
        const requestOrigin = new URL(request.url).origin;
        if (isLocalDevOrigin(requestOrigin)) {
            return requestOrigin;
        }
    }

    return DEFAULT_PUBLIC_APP_ORIGIN;
}
