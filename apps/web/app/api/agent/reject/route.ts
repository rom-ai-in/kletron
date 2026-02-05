import { NextResponse } from "next/server";
import { SafeEditGate } from "@numezis/server/services/agent/SafeEditGate";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gate = SafeEditGate.getInstance();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const editId = (body as any).editId;
  const conversationId = (body as any).conversationId;
  const action = (body as any).action;

  if (conversationId && action === "all") {
    try {
      const edits = gate.rejectAll(conversationId);
      return NextResponse.json({ success: true, rejected: edits.length });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  if (!editId) {
    return NextResponse.json({ error: "Edit ID is required" }, { status: 400 });
  }

  try {
    gate.rejectEdit(editId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
