import { validateUserCredentials } from '../../../../lib/validateUserCredentials';
import { resolveDemoCredentials } from "../../../../lib/demoCredentials";

/** Loaded only when Credentials `authorize` runs (not on GET /api/auth/session). */
export async function authorizeCredentials(
    credentials: Partial<Record<'email' | 'password', string>> | undefined
) {
    if (!credentials?.email || !credentials?.password) {
        return null;
    }

    // Real database users win over the built-in demo identity. The demo profile
    // resolves to a synthetic id (`test-user-1`) that is not backed by a row in
    // `users`, so matching it first would shadow a genuine account sharing the
    // same address (e.g. demo@kletron.local) and silently detach the session
    // from that user's real organization.
    const user = await validateUserCredentials(credentials.email, credentials.password);

    if (user) {
        return {
            id: user.id,
            email: user.email,
            name: user.fullName || undefined,
        };
    }

    // Fallback for fresh installs with an empty `users` collection. Disabled in
    // production by resolveDemoCredentials itself.
    const demoProfile = await resolveDemoCredentials(credentials.email, credentials.password);
    if (demoProfile) {
        return demoProfile;
    }

    return null;
}
