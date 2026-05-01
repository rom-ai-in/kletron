// apps/web/config/auth.ts
// Centralized authentication configuration
import type { AuthOptions } from "next-auth";

const { initializeTestUser, findTestUser, verifyPassword } = require('../lib/auth');

export const authConfig: AuthOptions = {
  providers: [], // Will be populated in the actual route file
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