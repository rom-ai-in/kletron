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
  const title = (body as any).title;

  if (!conversationId || typeof conversationId !== "string") {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, body);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const service = new ConversationService(workspace._id.toString());
  try {
    const conversation = await service.get(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await service.updateTitle(conversationId, title.trim());
    return NextResponse.json({ success: true, title: title.trim() });
  } catch (e: any) {
    console.error("[API /api/agent/update-title PUT] Error:", e);
    return NextResponse.json({ error: "Failed to update title" }, { status: 500 });
  }
}
