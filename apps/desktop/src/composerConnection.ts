export type ComposerConnectionDot = boolean | "checking";

export type LlmStatusForComposer = "success" | "error" | "loading" | "none";

/**
 * Single source of truth for the composer status dot, tooltip, and whether the
 * input should be disabled. Checks run in order: URL → backend probe → auth →
 * workspace → LLM health.
 */
export function getComposerConnectionState(args: {
  backendUrlValid: boolean;
  backendConnected: boolean;
  hasAccessToken: boolean;
  activeWorkspaceId: string | null;
  llmStatus: LlmStatusForComposer;
  llmProviderLabel: string;
  /**
   * When true (Codex execution path), LangGraph LLM reachability is optional — do not treat
   * error/none as a broken connection for the composer chrome.
   */
  langGraphLlmOptional?: boolean;
}): {
  connected: ComposerConnectionDot;
  connectionLabel: string;
  composerDisabled: boolean;
} {
  const {
    backendUrlValid,
    backendConnected,
    hasAccessToken,
    activeWorkspaceId,
    llmStatus,
    llmProviderLabel,
    langGraphLlmOptional,
  } = args;
  const label = llmProviderLabel.trim() || "LLM";

  if (!backendUrlValid) {
    return { connected: false, connectionLabel: "Invalid backend URL", composerDisabled: true };
  }
  if (!backendConnected) {
    return { connected: false, connectionLabel: "Backend unreachable", composerDisabled: true };
  }
  if (!hasAccessToken) {
    return { connected: false, connectionLabel: "Sign in required", composerDisabled: true };
  }
  if (!activeWorkspaceId) {
    return { connected: false, connectionLabel: "Select a workspace", composerDisabled: true };
  }

  if (langGraphLlmOptional && (llmStatus === "error" || llmStatus === "none")) {
    return {
      connected: true,
      connectionLabel: "Codex mode — LangGraph LLM not required",
      composerDisabled: false,
    };
  }

  if (llmStatus === "loading") {
    return { connected: "checking", connectionLabel: `Checking ${label}…`, composerDisabled: false };
  }
  if (llmStatus === "success") {
    return { connected: true, connectionLabel: `${label} ready`, composerDisabled: false };
  }
  if (llmStatus === "none") {
    return { connected: false, connectionLabel: `${label} — choose a model in Settings`, composerDisabled: false };
  }
  return {
    connected: false,
    connectionLabel: `${label} — check Configuration in Settings`,
    composerDisabled: false,
  };
}
