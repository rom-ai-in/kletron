// app/api/auth/[...nextauth]/route.ts
// NextAuth entry point with credentials provider
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { validateUserCredentials } from '../../../../lib/validateUserCredentials';
import { findTestUser, verifyPassword } from '../../../../lib/auth';
import { initializeTestUser } from '../../../../lib/auth';

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                // Dev: check test user first
                await initializeTestUser();
                const testUser = findTestUser(credentials.email as string);
                if (testUser) {
                    const isValid = await verifyPassword(
                        credentials.password as string,
                        testUser.passwordHash
                    );
                    if (isValid) {
                        return {
                            id: 'test-user-1',
                            email: testUser.email,
                            name: 'Romain Client',
                        };
                    }
                }

                // Production: validate against MongoDB
                const user = await validateUserCredentials(
                    credentials.email as string,
                    credentials.password as string
                );

                if (user) {
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.fullName || undefined,
                    };
                }

                return null;
            },
        }),
    ],
    session: {
        strategy: "jwt" as const,
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    jwt: {
        secret: process.env.NEXTAUTH_SECRET,
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id as string;
            }
            return session;
        },
    },
    pages: {
        signIn: '/auth/login',
        signOut: '/auth/login',
    },
});

export { handler as GET, handler as POST };
