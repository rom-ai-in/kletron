import { findTestUser, initializeTestUser, verifyPassword } from "./auth";

export interface DemoSessionProfile {
    id: "test-user-1";
    email: string;
    name: "Demo User";
}

/**
 * Demo credentials are strictly non-production. Returning a demo JWT in prod
 * leaks a fake user id (`test-user-1`) into account-backed flows such as
 * connector OAuth and profile updates.
 */
export async function resolveDemoCredentials(
    email: string,
    password: string
): Promise<DemoSessionProfile | null> {
    if (process.env.NODE_ENV === "production") {
        return null;
    }

    await initializeTestUser();
    const testUser = findTestUser(email);
    if (!testUser) {
        return null;
    }

    const isValid = await verifyPassword(password, testUser.passwordHash);
    if (!isValid) {
        return null;
    }

    return {
        id: "test-user-1",
        email: testUser.email,
        name: "Demo User",
    };
}
