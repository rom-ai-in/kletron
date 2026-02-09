import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { agentGraphRunService } from "@numezis/server/services/agentGraphRunService";
import { getChatModel } from "@numezis/server/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * PUT /api/sessions/[id]/title - Update session title.
 * Body: { title: string } or { generate: true, userMessage: string }
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const directTitle = typeof body?.title === "string" ? body.title.trim() : "";
  const generate = body?.generate === true;
  const userMessage = typeof body?.userMessage === "string" ? body.userMessage : "";

  try {
    let finalTitle = directTitle;

    if (generate && userMessage) {
      // Strip [System: ...] personality prefix if present
      let cleanMessage = userMessage;
      if (cleanMessage.startsWith("[System:") && cleanMessage.indexOf("]\n\n") !== -1) {
        cleanMessage = cleanMessage.slice(cleanMessage.indexOf("]\n\n") + 3).trim();
      }

      // Auto-generate title via LLM
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
        new HumanMessage(`User message: "${cleanMessage.substring(0, 500)}"`),
      ]);
      finalTitle = String(response.content).trim().replace(/^["']|["']$/g, "");
    }

    if (!finalTitle) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    await agentGraphRunService.updateTitle(params.id, finalTitle);
    return NextResponse.json({ success: true, title: finalTitle });
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Failed to update title" }, { status: 500 });
  }
}
