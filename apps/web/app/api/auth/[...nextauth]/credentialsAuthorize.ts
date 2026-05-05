import { validateUserCredentials } from '../../../../lib/validateUserCredentials';
import { resolveDemoCredentials } from "../../../../lib/demoCredentials";

/** Loaded only when Credentials `authorize` runs (not on GET /api/auth/session). */
export async function authorizeCredentials(
    credentials: Partial<Record<'email' | 'password', string>> | undefined
) {
    if (!credentials?.email || !credentials?.password) {
        return null;
    }

    const demoProfile = await resolveDemoCredentials(credentials.email, credentials.password);
    if (demoProfile) {
        return demoProfile;
    }

    const user = await validateUserCredentials(credentials.email, credentials.password);

    if (user) {
        return {
            id: user.id,
            email: user.email,
            name: user.fullName || undefined,
        };
    }

    return null;
}
