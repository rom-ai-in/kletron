import { NextResponse } from "next/server";
import { ReActEngine } from "@numezis/server/services/agent/ReActEngine";
import { SafeEditGate } from "@numezis/server/services/agent/SafeEditGate";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const engine = ReActEngine.getInstance();
  const gate = SafeEditGate.getInstance();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const editId = (body as any).editId;
  const conversationId = (body as any).conversationId;
  const action = (body as any).action;

  if (conversationId && action === "all") {
    try {
      const edits = gate.approveAll(conversationId);
      const results = [] as { id: string; success: boolean; error?: string }[];
      for (const edit of edits) {
        try {
          await engine.executeApprovedEdit(edit.id);
          results.push({ id: edit.id, success: true });
        } catch (e: any) {
          results.push({ id: edit.id, success: false, error: e.message });
        }
      }
      return NextResponse.json({ success: true, approved: results.length, results });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  if (!editId) {
    return NextResponse.json({ error: "Edit ID is required" }, { status: 400 });
  }

  try {
    await engine.executeApprovedEdit(editId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
