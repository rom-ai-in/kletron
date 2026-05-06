export type AgentExecutionBackendId = "langgraph" | "codex";

/**
 * Single source of truth: which execution surface is active for UI (matches {@link AgentSessionEngineStrip}).
 * Preference applies before first send; open thread follows persisted session backend.
 */
export function resolveAgentExecutionBackend(input: {
  preferenceBackend: AgentExecutionBackendId;
  sessionBackend: AgentExecutionBackendId | null | undefined;
  hasActiveSession: boolean;
}): AgentExecutionBackendId {
  if (!input.hasActiveSession) return input.preferenceBackend;
  return input.sessionBackend ?? "langgraph";
}
