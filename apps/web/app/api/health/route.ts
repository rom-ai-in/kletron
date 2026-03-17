import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
