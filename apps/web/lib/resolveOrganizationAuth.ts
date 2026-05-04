/**
 * Organization UI uses cookie sessions (NextAuth). Shared API auth now accepts
 * those cookies too, while still falling back to bearer tokens / dev bypass
 * for desktop and internal callers.
 */
import { getServerSession } from "next-auth";
import { authConfig } from "../config/auth";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import type { AuthResult } from "@kletron/server/lib/auth/apiAuth";

export async function resolveOrganizationAuth(request: Request): Promise<AuthResult | null> {
  try {
    const session = await getServerSession(authConfig);
    const id = session?.user ? (session.user as { id?: string }).id : undefined;
    if (id) {
      return { userId: String(id), authType: "session" };
    }
  } catch {
    /* session not available */
  }
  return requireAppRouteAuth(request);
}
