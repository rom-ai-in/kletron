// apps/web/lib/auth-options.ts
// Export authentication options for use in other routes
import type { AuthOptions } from "next-auth";

const { initializeTestUser, findTestUser, verifyPassword } = require('../lib/auth');

export const getAuthOptions = async (): Promise<AuthOptions> => {
  // Initialize test user for development
  await initializeTestUser();

  return {
    providers: [], // Will be set below
    session: {
      strategy: "jwt" as const,
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
      async jwt({ token, user }: { token: any; user?: any }) {
        if (user) {
          token.id = user.id;
        }
        return token;
      },
      async session({ session, token }: { session: any; token: any }) {
        if (session.user) {
          session.user.id = token.id as string;
        }
        return session;
      },
    },
  };
};