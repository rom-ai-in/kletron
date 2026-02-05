import { NextResponse } from "next/server";
import { ConversationService } from "@numezis/server/services/agent/ConversationService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const service = new ConversationService(workspace._id.toString());
  try {
    const list = await service.list();
    return NextResponse.json(list);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to list conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const service = new ConversationService(workspace._id.toString());
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const title = (body as any).title;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    const conversation = await service.create(String(title));
    return NextResponse.json(conversation);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to create conversation" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const service = new ConversationService(workspace._id.toString());
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const permanent = searchParams.get("permanent");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  try {
    if (permanent === "true") {
      await service.delete(id);
    } else {
      await service.archive(id);
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
