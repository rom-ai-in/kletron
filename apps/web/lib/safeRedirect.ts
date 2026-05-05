const DEFAULT_INTERNAL_REDIRECT = "/";

/**
 * Returns a same-origin path-only redirect target.
 *
 * We intentionally reject absolute URLs, protocol-relative URLs, and anything
 * that does not start with a single forward slash. This keeps auth and OAuth
 * callbacks from becoming open redirectors.
 */
export function normalizeInternalRedirect(
    input: string | null | undefined,
    fallback = DEFAULT_INTERNAL_REDIRECT
): string {
    if (typeof input !== "string") return fallback;

    const target = input.trim();
    if (!target) return fallback;
    if (!target.startsWith("/")) return fallback;
    if (target.startsWith("//")) return fallback;
    if (target.includes("\\") || target.includes("\u0000")) return fallback;

    return target;
}
