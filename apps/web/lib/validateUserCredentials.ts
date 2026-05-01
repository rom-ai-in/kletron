// apps/web/lib/validateUserCredentials.ts
// User credential validation using shared MongoDB connection
import bcrypt from 'bcrypt';
import { getDb } from '@kletron/server/lib/db';

export async function validateUserCredentials(email: string, password: string) {
    try {
        const db = await getDb();
        const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return null;
        }

        // Verify password with bcrypt
        const isValid = await bcrypt.compare(password, user.password);

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
