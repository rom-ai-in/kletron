import { NextResponse } from "next/server";
import { ConversationService } from "@numezis/server/services/agent/ConversationService";
import { getChatModel } from "@numezis/server/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const conversationId = (body as any).conversationId;
  const userMessage = (body as any).userMessage;

  if (!conversationId || typeof conversationId !== "string") {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  if (!userMessage || typeof userMessage !== "string") {
    return NextResponse.json({ error: "Missing userMessage" }, { status: 400 });
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

    const llm = await getChatModel(undefined, { temperature: 0.7 });

    const systemPrompt = `You are a helpful assistant that generates very short, concise chat titles.
Given the user's message, generate a title that is:
- Maximum 4-5 words
- Descriptive of the topic
- No quotes, no punctuation at the end
- Professional and clear

Respond with ONLY the title, nothing else.`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(`User message: "${userMessage.substring(0, 500)}"`),
    ]);

    const generatedTitle = String(response.content).trim().replace(/^["']|["']$/g, "");

    await service.updateTitle(conversationId, generatedTitle);

    return NextResponse.json({ success: true, title: generatedTitle });
  } catch (e: any) {
    console.error("[API /api/agent/generate-title POST] Error:", e);
    return NextResponse.json({ error: "Failed to generate title" }, { status: 500 });
  }
}
