// apps/web/lib/validateUserCredentials.ts
// User credential validation using shared MongoDB connection
import { getDb } from '@kletron/server/lib/db';

export async function validateUserCredentials(email: string, password: string) {
    try {
        const bcrypt = (await import('bcrypt')).default;
        const db = await getDb();
        const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return null;
        }

        const storedHash =
            typeof user.passwordHash === 'string'
                ? user.passwordHash
                : typeof user.password === 'string'
                  ? user.password
                  : null;
        if (!storedHash) {
            return null;
        }

        const isValid = await bcrypt.compare(password, storedHash);

        if (!isValid) {
            return null;
        }

        return {
            id: user._id.toString(),
            email: user.email,
            fullName: user.name || undefined,
        };
    } catch (error) {
        console.error('Error validating credentials:', error);
        return null;
    }
}
