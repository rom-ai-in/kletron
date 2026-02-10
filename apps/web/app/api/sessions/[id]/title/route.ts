import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { agentGraphRunService } from "@numezis/server/services/agentGraphRunService";
import { getChatModel } from "@numezis/server/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LLM_RETRY_COUNT = 2;
const LLM_RETRY_BASE_MS = 800; // exponential backoff: 800ms, 1600ms

/** Strip [System: ...] personality prefix if present. */
function stripSystemPrefix(text: string): string {
  if (text.startsWith("[System:") && text.indexOf("]\n\n") !== -1) {
    return text.slice(text.indexOf("]\n\n") + 3).trim();
  }
  return text;
}

/**
 * Heuristic fallback: capitalise the first 5 meaningful words of the message.
 * Used when the LLM call fails after all retries.
 */
function heuristicTitle(message: string): string {
  const words = message
    .replace(/[^\w\s'-]/g, " ") // strip non-word chars
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  if (words.length === 0) return "Untitled";
  // Capitalise first word, keep the rest as-is
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

/** Attempt to generate a title via LLM with retries + exponential backoff. */
async function generateTitleWithLLM(cleanMessage: string): Promise<string | null> {
  const systemPrompt = `You are a helpful assistant that generates very short, concise chat titles.
Given the user's message, generate a title that is:
- Maximum 4-5 words
- Descriptive of the topic
- No quotes, no punctuation at the end
- Professional and clear

Respond with ONLY the title, nothing else.`;

  for (let attempt = 0; attempt <= LLM_RETRY_COUNT; attempt++) {
    try {
      const llm = await getChatModel(undefined, { temperature: 0.7 });
      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`User message: "${cleanMessage.substring(0, 500)}"`),
      ]);
      const title = String(response.content).trim().replace(/^["']|["']$/g, "");
      if (title) return title;
    } catch (err) {
      console.warn(
        `[title-gen] LLM attempt ${attempt + 1}/${LLM_RETRY_COUNT + 1} failed:`,
        (err as Error)?.message ?? err,
      );
    }
    // Exponential backoff before next retry (skip after last attempt)
    if (attempt < LLM_RETRY_COUNT) {
      await new Promise((r) => setTimeout(r, LLM_RETRY_BASE_MS * 2 ** attempt));
    }
  }
  return null; // all retries exhausted
}

// ─── Route ────────────────────────────────────────────────────────────────────

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
      const cleanMessage = stripSystemPrefix(userMessage);

      // Try LLM generation with retries
      const llmTitle = await generateTitleWithLLM(cleanMessage);

      if (llmTitle) {
        finalTitle = llmTitle;
      } else {
        // All LLM retries failed — use heuristic fallback
        console.warn(
          `[title-gen] All LLM retries exhausted for session ${params.id}, using heuristic fallback.`,
        );
        finalTitle = heuristicTitle(cleanMessage);
      }
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
