export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { setActiveWorkspaceId } from "@kletron/server/services/workspaceService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await setActiveWorkspaceId(auth.userId, workspaceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = (error as Error)?.message ?? "Failed to select workspace";
    const lower = message.toLowerCase();
    const status =
      lower.includes("not found") ? 404 : lower.includes("invalid") ? 400 : 400;
    return NextResponse.json({ error: message, message }, { status });
  }
}
