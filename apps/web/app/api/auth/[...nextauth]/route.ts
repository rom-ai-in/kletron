// app/api/auth/[...nextauth]/route.ts
// NextAuth entry point — options live in config/auth.ts
import NextAuth from "next-auth";
import { authConfig } from "../../../../config/auth";

const handler = NextAuth(authConfig);

export { handler as GET, handler as POST };
