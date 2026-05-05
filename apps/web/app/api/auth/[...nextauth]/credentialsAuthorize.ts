import { validateUserCredentials } from '../../../../lib/validateUserCredentials';
import { initializeTestUser, findTestUser, verifyPassword } from '../../../../lib/auth';

/** Loaded only when Credentials `authorize` runs (not on GET /api/auth/session). */
export async function authorizeCredentials(
    credentials: Partial<Record<'email' | 'password', string>> | undefined
) {
    if (!credentials?.email || !credentials?.password) {
        return null;
    }

    // Demo credentials only in non-production — avoids JWT ids like `test-user-1` that cannot use Mongo-backed profile APIs.
    if (process.env.NODE_ENV !== 'production') {
        await initializeTestUser();
        const testUser = findTestUser(credentials.email);
        if (testUser) {
            const isValid = await verifyPassword(credentials.password, testUser.passwordHash);
            if (isValid) {
                return {
                    id: 'test-user-1',
                    email: testUser.email,
                    name: 'Romain Client',
                };
            }
        }
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
