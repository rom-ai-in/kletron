import { closeDb, getDb } from "../packages/server/src/lib/db";
import {
  sanitizeAssistantVisibleContent,
  sanitizeTitle,
  stripSystemPrefix,
  stripThoughtContent,
} from "../packages/server/src/services/titleSanitizer";

type AgentEventLike = {
  kind?: string;
  content?: string;
  [key: string]: unknown;
};

type AgentRunLike = {
  _id: { toString(): string };
  title?: string;
  state?: {
    conversationHistory?: AgentEventLike[];
    [key: string]: unknown;
  };
};

type UpdatePayload = {
  runId: string;
  conversationHistory: AgentEventLike[];
  title?: string;
};

const hasFlag = (flag: string) => process.argv.includes(flag);
const getArgValue = (name: string): string | null => {
  const idx = process.argv.findIndex((arg) => arg === name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
};

const TITLE_LEAK_RE =
  /\brespond with only the title\b|\bwe need to produce a short chat title\b|\bnow,\s*the user wants to know\b|^we need to (output|produce|provide)\b|<think>/i;
const MESSAGE_LEAK_RE =
  /\bgiven the pattern\b|\bapproval required\b|\bwe can proceed to output a final answer\b|\bthe user asked to\b|\bwe must not make further tool calls\b|\bnow,\s*the user wants to know\b|\bprovide (a )?structured analysis\b|\bproceed to final\b|\bthis should satisfy the user request\b/i;

async function main() {
  const apply = hasFlag("--apply");
  const limitRaw = getArgValue("--limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const db = await getDb();
  const runs = db.collection("agent_graph_runs");

  const filter: Record<string, unknown> = {
    $or: [{ "state.conversationHistory.0": { $exists: true } }, { title: { $type: "string" } }],
  };

  const cursor = runs.find(filter).project({ _id: 1, title: 1, state: 1 });
  if (Number.isFinite(limit) && (limit as number) > 0) {
    cursor.limit(limit as number);
  }

  let scanned = 0;
  let changedRuns = 0;
  let cleanedMessages = 0;
  let removedMessages = 0;
  let cleanedTitles = 0;
  const updates: UpdatePayload[] = [];

  for await (const run of cursor as unknown as AsyncIterable<AgentRunLike>) {
    scanned += 1;
    const sourceHistory = Array.isArray(run?.state?.conversationHistory)
      ? run.state!.conversationHistory!
      : [];

    let runChanged = false;
    const cleanedHistory: AgentEventLike[] = [];

    for (const event of sourceHistory) {
      const original = typeof event?.content === "string" ? event.content : "";
      const stripped = stripThoughtContent(original).trim();
      const sanitized = sanitizeAssistantVisibleContent(stripped).trim();
      const forcedBlank =
        !sanitized ||
        /\brespond with only the title\b/i.test(sanitized) ||
        /\bwe need to produce a short chat title\b/i.test(sanitized) ||
        MESSAGE_LEAK_RE.test(sanitized);

      if (forcedBlank && (event?.kind === "assistant" || event?.kind === "user")) {
        removedMessages += 1;
        runChanged = true;
        continue;
      }

      if (typeof event?.content === "string" && sanitized !== original) {
        cleanedMessages += 1;
        runChanged = true;
        cleanedHistory.push({ ...event, content: sanitized });
      } else {
        cleanedHistory.push(event);
      }
    }

    const rawTitle = typeof run.title === "string" ? run.title.trim() : "";
    let nextTitle: string | undefined;
    if (rawTitle) {
      const titleInput = stripSystemPrefix(stripThoughtContent(rawTitle)).trim();
      const sanitized = sanitizeTitle(titleInput);
      if (sanitized && sanitized !== rawTitle) {
        nextTitle = sanitized;
        cleanedTitles += 1;
        runChanged = true;
      } else if (!sanitized && TITLE_LEAK_RE.test(rawTitle)) {
        nextTitle = "Untitled";
        cleanedTitles += 1;
        runChanged = true;
      }
    }

    if (runChanged) {
      changedRuns += 1;
      updates.push({
        runId: run._id.toString(),
        conversationHistory: cleanedHistory,
        ...(nextTitle !== undefined ? { title: nextTitle } : {}),
      });
    }
  }

  if (apply && updates.length > 0) {
    const bulk = updates.map((u) => ({
      updateOne: {
        filter: { _id: u.runId },
        update: {
          $set: {
            "state.conversationHistory": u.conversationHistory,
            ...(u.title !== undefined ? { title: u.title } : {}),
          },
        },
      },
    }));

    // _id is ObjectId in DB; convert filters accordingly in one pass.
    const { ObjectId } = await import("mongodb");
    const normalizedBulk = bulk.map((op) => ({
      updateOne: {
        ...op.updateOne,
        filter: { _id: new ObjectId(op.updateOne.filter._id) },
      },
    }));
    await runs.bulkWrite(normalizedBulk, { ordered: false });
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scanned,
        changedRuns,
        cleanedMessages,
        removedMessages,
        cleanedTitles,
        updatedInDb: apply ? updates.length : 0,
      },
      null,
      2
    )
  );

  await closeDb();
}

main().catch(async (error) => {
  console.error("[cleanup-agent-history] failed:", (error as Error)?.message ?? error);
  await closeDb().catch(() => {});
  process.exit(1);
});
