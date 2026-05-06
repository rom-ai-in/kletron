/**
 * LLM strip on the Agent shows live health for the LangGraph provider. When the user runs
 * Codex, that health is irrelevant (LM Studio can be off) — avoid a misleading red dot.
 */
export type LlmStripHealthStatus = "success" | "error" | "loading" | "none";

export function effectiveLlmStripHealth(input: {
  llmStatus: LlmStripHealthStatus;
  llmStatusDetail: string | null;
  userExecutionBackend: "langgraph" | "codex";
  /** From GET /api/sessions/:id when a thread is open; defaults to LangGraph for legacy runs */
  sessionExecutionBackend?: "langgraph" | "codex" | null;
  hasActiveSession: boolean;
}): {
  status: LlmStripHealthStatus;
  detail: string | null;
  /** Short label for the selector ("LG" when Codex context so it fits the strip) */
  selectorLabel: string;
} {
  const sessionBackend = input.sessionExecutionBackend ?? "langgraph";
  const runUsesCodex =
    (input.hasActiveSession && sessionBackend === "codex") ||
    (!input.hasActiveSession && input.userExecutionBackend === "codex");

  if (!runUsesCodex) {
    return {
      status: input.llmStatus,
      detail: input.llmStatusDetail,
      selectorLabel: "LLM",
    };
  }

  return {
    status: "none",
    detail:
      "LangGraph provider only (automations & LangGraph chats). Codex uses the local CLI — LM Studio does not need to run.",
    selectorLabel: "LG",
  };
}
