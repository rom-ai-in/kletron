/**
 * NextAuth sessions backed by MongoDB `users` use a 24-character hex ObjectId string as `user.id`.
 * Built-in demo login uses ids like `test-user-1`, which cannot update email/password via `/api/auth/profile`.
 */
export function isMongoBackedUserId(id: unknown): boolean {
    return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
}

export const DEMO_ACCOUNT_PROFILE_HELP =
    'You are signed in with the built-in demo account. Sign out and sign in with your registered Kletron email and password to change email or password.';
