import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function POST(request: Request, context: { params: { runId: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId } = context.params;
  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const diff = (body as any).diff;

  if (!diff) {
    return NextResponse.json({ error: "Missing diff" }, { status: 400 });
  }

  return NextResponse.json({ status: "applied", runId });
}
