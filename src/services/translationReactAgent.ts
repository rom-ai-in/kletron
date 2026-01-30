import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

import { getChatModel, type LlmSelection } from "@/src/llm";
import { config } from "@/src/config";
import { allMcpTools } from "@/src/tools/mcpTools";
import { extractJsonObject } from "@/src/lib/jsonExtract";
import type { TranslationRecord } from "@/src/services/i18nTranslationsService";

export const TranslationDecisionSchema = z.enum(["KEEP", "UPDATE"]);
export type TranslationDecision = z.infer<typeof TranslationDecisionSchema>;

export const TranslationEvidenceSchema = z.object({
  type: z.enum(["file", "search", "other"]),
  path: z.string().optional(),
  snippet: z.string().optional(),
});
export type TranslationEvidence = z.infer<typeof TranslationEvidenceSchema>;

export const TranslationProposedValuesSchema = z.object({
  en: z.string().optional(),
  de: z.string().optional(),
  fr: z.string().optional(),
  it: z.string().optional(),
});
export type TranslationProposedValues = z.infer<typeof TranslationProposedValuesSchema>;

export const TranslationRecommendationSchema = z.object({
  rowKey: z.string().min(1),
  decision: TranslationDecisionSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  proposed: TranslationProposedValuesSchema.optional(),
  changedLocales: z.array(z.enum(["en", "de", "fr", "it"])).optional(),
  evidence: z.array(TranslationEvidenceSchema).optional(),
});
export type TranslationRecommendation = z.infer<typeof TranslationRecommendationSchema>;

export const TranslationAgentOutputSchema = z.object({
  recommendations: z.array(TranslationRecommendationSchema),
});
export type TranslationAgentOutput = z.infer<typeof TranslationAgentOutputSchema>;

export type TranslationAgentRowInput = Pick<
  TranslationRecord,
  "namespace" | "key" | "source_file" | "context_usage" | "en" | "de" | "fr" | "it" | "status"
> & { rowKey: string };

export const LocaleKeySchema = z.enum(["en", "de", "fr", "it"]);
export type LocaleKey = z.infer<typeof LocaleKeySchema>;

const locales: LocaleKey[] = ["en", "de", "fr", "it"];

export function computeChangedLocales(
  original: TranslationAgentRowInput,
  proposed?: TranslationProposedValues
): LocaleKey[] {
  if (!proposed) return [];
  const changed: LocaleKey[] = [];
  for (const loc of locales) {
    const p = proposed[loc];
    if (typeof p !== "string") continue;
    const o = (original[loc] ?? "") as string;
    if (p !== o) changed.push(loc);
  }
  return changed;
}

function stripLargeText(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen) + "\n…(truncated)…";
}

function buildSystemPrompt() {
  return [
    "You are TranslationReAct, a senior localization QA and rewriting agent for a software product.",
    "",
    "Mission:",
    "- Review translations for quality issues: missing/empty, unaligned meaning vs English, inconsistent tone/terminology, placeholder residue (e.g. 'FR:'), grammar issues, awkward phrasing.",
    "- Propose improved translations only when needed. If a translation is already good, keep it.",
    "- When de/fr/it simply mirror the English string and it looks like an untranslated UI label or placeholder (e.g. multi-word category/feature text), treat those locales as needing localization and prefer UPDATE unless the string is clearly an invariant such as a brand name, acronym, or numeric badge.",
    "",
    "Context gathering:",
    "- Use the available tools to fetch concrete context from the repository when needed.",
    "- Prefer reading the files referenced by context_usage and source_file to understand UI intent and terminology.",
    "- Use search tools when direct file reads are insufficient.",
    "",
    "Hard rules:",
    "- Preserve placeholders exactly (e.g. {name}, {{count}}, %s) across all locales.",
    "- Do NOT invent new product names or change established branding.",
    "- Preserve brand names, acronyms, and numeric badges (e.g. IBAN, 500+). Only keep identical values when you can justify why the same English text should remain in every locale.",
    "- Do NOT call write tools (write_file/execute_bash/str_replace_editor). This is a review-only task.",
    "- Output MUST be strict JSON only (no markdown, no prose).",
    "- Never invent row keys. Only use rowKey values that appear in the provided input rows.",
  ].join("\n");
}

function buildUserPrompt(inputRows: TranslationAgentRowInput[]) {
  const compact = inputRows.map((r) => ({
    rowKey: r.rowKey,
    namespace: r.namespace,
    key: r.key,
    source_file: r.source_file,
    context_usage: r.context_usage,
    values: { en: r.en ?? "", de: r.de ?? "", fr: r.fr ?? "", it: r.it ?? "" },
  }));

  return [
    "Review the following translation rows and output recommendations.",
    "",
    "CRITICAL OUTPUT REQUIREMENTS:",
    `- You MUST return exactly ${inputRows.length} recommendations (one per input row).`,
    "- The recommendations MUST be in the same order as the input rows.",
    '- You MUST copy the "rowKey" exactly from each input row (do not modify, do not shorten, do not reformat).',
    "- If a row is already good or you are unsure, set decision=KEEP with a short rationale.",
    "",
    "Output JSON schema:",
    "{",
    '  "recommendations": [',
    "    {",
    '      "rowKey": "namespace.key",',
    '      "decision": "KEEP|UPDATE",',
    '      "confidence": 0.0,',
    '      "rationale": "short reason",',
    '      "proposed": { "en": "...", "de": "...", "fr": "...", "it": "..." }, // only if decision=UPDATE',
    '      "changedLocales": ["en","de"], // optional',
    '      "evidence": [{"type":"file","path":"...","snippet":"..."}] // optional',
    "    }",
    "  ]",
    "}",
    "",
    "Notes:",
    "- You may update EN too if it improves clarity/tone.",
    "- If you update a locale, provide the full new value string.",
    "- Keep rationale concise (1-2 sentences).",
    "- When non-English locales currently reuse the English copy and the row is not a known invariant, lean toward UPDATE with localized text and explain that the previous English placeholder was translated.",
    "",
    "Rows:",
    stripLargeText(JSON.stringify(compact, null, 2), 24000),
  ].join("\n");
}

async function runSchemaReactAgent<T extends z.ZodTypeAny>(opts: {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  tools: any[];
  schema: T;
  fallback: z.infer<T>;
  llmSelection?: Partial<LlmSelection>;
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  maxToolCalls?: number;
}): Promise<{ parsed: z.infer<T>; messages: BaseMessage[] }> {
  // Lower temperature for this schema-driven workflow to reduce partial/invalid outputs.
  const model = await getChatModel(opts.llmSelection, { temperature: 0 });
  const agent = createReactAgent({
    llm: model,
    tools: opts.tools,
    prompt: new SystemMessage(opts.systemPrompt),
    name: opts.name,
  });

  const stream = await agent.stream(
    { messages: [new HumanMessage(opts.userPrompt)] },
    { streamMode: "values", recursionLimit: config.graphRecursionLimit }
  );

  const seenMessageIds = new Set<string>();
  const accumulatedMessages: BaseMessage[] = [];
  let lastState: { messages?: BaseMessage[] } | undefined;
  let toolCallCount = 0;
  let toolLimitReached = false;

  for await (const state of stream) {
    if (!state || typeof state !== "object") continue;
    lastState = state as { messages?: BaseMessage[] };
    if (!Array.isArray(lastState.messages)) continue;

    for (const message of lastState.messages) {
      const idKey =
        typeof message.id === "string"
          ? message.id
          : `${(message as any).role ?? "unknown"}-${typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content ?? "")
          }-${accumulatedMessages.length}`;

      if (seenMessageIds.has(idKey)) continue;
      seenMessageIds.add(idKey);
      accumulatedMessages.push(message);

      if (opts.onMessage) {
        await opts.onMessage(message);
      }

      const hasToolCall =
        message.type === "tool" ||
        Boolean((message as any).additional_kwargs?.function_call) ||
        Boolean((message as any).additional_kwargs?.tool_calls?.length) ||
        Boolean((message as any).tool_calls?.length);

      if (hasToolCall) {
        toolCallCount += 1;
        if (opts.maxToolCalls && toolCallCount >= opts.maxToolCalls) {
          toolLimitReached = true;
          break;
        }
      }
    }
    if (toolLimitReached) break;
  }

  const finalMessages = lastState?.messages ?? accumulatedMessages;

  const lastAssistantWithJson = [...finalMessages]
    .reverse()
    .find(
      (message) =>
        (message as any).role === "assistant" &&
        typeof (message as any).content === "string" &&
        (message as any).content.includes("{")
    );

  const lastAssistant = [...finalMessages].reverse().find((message) => (message as any).role === "assistant");
  const last = lastAssistantWithJson ?? lastAssistant ?? finalMessages.at(-1);

  if (!last) return { parsed: opts.fallback, messages: finalMessages };

  const content = typeof (last as any).content === "string" ? (last as any).content : JSON.stringify((last as any).content ?? "");

  const tryParseAndValidate = (text: string): { ok: boolean; data?: any; error?: string } => {
    try {
      const json = extractJsonObject(text);
      const result = opts.schema.safeParse(json);
      if (result.success) return { ok: true, data: result.data };
      return { ok: false, error: result.error.toString() };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  let attempt = tryParseAndValidate(content);
  if (attempt.ok) return { parsed: attempt.data, messages: finalMessages };

  // One repair attempt
  try {
    const repairPrompt = [
      "You are a JSON repair tool.",
      "The previous output was invalid JSON or did not match the required schema.",
      `Error details: ${attempt.error}`,
      "",
      "Task: Return ONLY strict JSON that matches the schema. No prose, no markdown.",
      "Input to repair:",
      content,
    ].join("\n");

    const repairResponse = await model.invoke([
      new SystemMessage("Return only strict JSON. Do not include any other text."),
      new HumanMessage(repairPrompt),
    ]);
    const repaired = typeof repairResponse.content === "string" ? repairResponse.content : JSON.stringify(repairResponse.content ?? "");
    attempt = tryParseAndValidate(repaired);
    if (attempt.ok) return { parsed: attempt.data, messages: finalMessages };
  } catch {
    // ignore
  }

  return { parsed: opts.fallback, messages: finalMessages };
}

export async function runTranslationAgentChunk(opts: {
  rows: TranslationAgentRowInput[];
  llmSelection?: Partial<LlmSelection>;
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  maxToolCalls?: number;
}): Promise<{ output: TranslationAgentOutput; messages: BaseMessage[] }> {
  const fallback: TranslationAgentOutput = {
    recommendations: opts.rows.map((r) => ({
      rowKey: r.rowKey,
      decision: "KEEP",
      confidence: 0.2,
      rationale: "Fallback: agent did not return a valid structured output.",
    })),
  };

  const { parsed, messages } = await runSchemaReactAgent({
    name: "TranslationReAct",
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(opts.rows),
    tools: allMcpTools,
    schema: TranslationAgentOutputSchema,
    fallback,
    llmSelection: opts.llmSelection,
    onMessage: opts.onMessage,
    maxToolCalls: opts.maxToolCalls ?? 20,
  });

  // Align to input rowKeys to guarantee 1:1 coverage (models sometimes omit rows or return wrong keys).
  const inputRowKeys = opts.rows.map((r) => r.rowKey);
  const allowed = new Set(inputRowKeys);
  const byKey = new Map<string, TranslationRecommendation>();
  for (const rec of parsed.recommendations ?? []) {
    const rk = rec.rowKey.trim();
    if (!allowed.has(rk)) continue;
    const existing = byKey.get(rk);
    if (!existing) {
      byKey.set(rk, { ...rec, rowKey: rk });
      continue;
    }
    // Prefer UPDATE when duplicates occur
    if (existing.decision !== "UPDATE" && rec.decision === "UPDATE") {
      byKey.set(rk, { ...rec, rowKey: rk });
    }
  }

  const normalized: TranslationAgentOutput = {
    recommendations: inputRowKeys.map((rk) => {
      const original = opts.rows.find((r) => r.rowKey === rk);
      const existing = byKey.get(rk);
      if (!existing) {
        return {
          rowKey: rk,
          decision: "KEEP",
          confidence: 0.25,
          rationale: "Model did not return a valid recommendation for this row; defaulted to KEEP.",
          changedLocales: [],
        };
      }
      const changedLocales = original ? computeChangedLocales(original, existing.proposed) : existing.changedLocales ?? [];
      return { ...existing, rowKey: rk, changedLocales };
    }),
  };

  return { output: normalized, messages };
}
