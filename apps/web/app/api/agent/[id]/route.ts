import { NextResponse } from "next/server";
import { ConversationService } from "@numezis/server/services/agent/ConversationService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export async function GET(request: Request, context: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const service = new ConversationService(workspace._id.toString());
  try {
    const conversation = await service.get(id);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json(conversation);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to load conversation" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const service = new ConversationService(workspace._id.toString());
  try {
    await service.archive(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to archive conversation" },
      { status: 500 }
    );
  }
}
