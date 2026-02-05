import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const prompt = (body as any).prompt;
  const agentId = (body as any).agentId;

  if (!prompt || !agentId) {
    return NextResponse.json({ error: "Missing prompt or agentId" }, { status: 400 });
  }

  const runId = `run-${Date.now()}`;
  return NextResponse.json({ runId, status: "queued" });
}
