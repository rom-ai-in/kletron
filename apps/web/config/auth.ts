// apps/web/config/auth.ts
// Single source of truth for NextAuth — used by [...nextauth] and getServerSession()
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export const authConfig: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const { authorizeCredentials } = await import(
                    "../app/api/auth/[...nextauth]/credentialsAuthorize"
                );
                return authorizeCredentials(credentials);
            },
        }),
    ],
    session: {
        strategy: "jwt" as const,
        maxAge: SESSION_MAX_AGE,
    },
    jwt: {
        secret: process.env.NEXTAUTH_SECRET,
        maxAge: SESSION_MAX_AGE,
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = (user as { id: string }).id;
                token.email = (user as { email?: string }).email;
                token.name = (user as { name?: string | null }).name;
            }
            if (trigger === "update" && session && typeof session === "object") {
                const s = session as Record<string, unknown>;
                if (typeof s.email === "string") {
                    token.email = s.email;
                }
                if (s.name !== undefined) {
                    token.name = s.name as string | null | undefined;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { id?: string }).id = token.id as string;
                if (typeof token.email === "string") {
                    session.user.email = token.email;
                }
                if (token.name !== undefined) {
                    session.user.name = token.name as string | null;
                }
            }
            return session;
        },
    },
    pages: {
        signIn: "/auth/login",
        signOut: "/auth/login",
    },
};
