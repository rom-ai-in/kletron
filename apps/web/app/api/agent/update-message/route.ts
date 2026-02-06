import { NextResponse } from "next/server";
import { ConversationService } from "@numezis/server/services/agent/ConversationService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export async function PUT(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const conversationId = (body as any).conversationId;
  const index = Number((body as any).index);
  const content = (body as any).content;

  if (!conversationId || typeof conversationId !== "string") {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Invalid message index" }, { status: 400 });
  }

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, body);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }

  const service = new ConversationService(workspace._id.toString());

  try {
    await service.updateMessage(conversationId, index, content.trim());
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const message = (e as Error)?.message ?? "Failed to update message";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.toLowerCase().includes("index")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[API /api/agent/update-message PUT] Error:", e);
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}
