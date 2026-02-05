import { NextResponse } from "next/server";
import { SafeEditGate } from "@numezis/server/services/agent/SafeEditGate";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gate = SafeEditGate.getInstance();
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId") ?? undefined;

  try {
    const edits = gate.listPendingEdits(conversationId);
    console.log(`[/api/agent/edits] Returning ${edits.length} pending edits for conversationId: ${conversationId}`);
    return NextResponse.json(edits);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
