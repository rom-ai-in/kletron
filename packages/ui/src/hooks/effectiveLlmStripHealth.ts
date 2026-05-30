export type LlmStripHealthStatus = "success" | "error" | "loading" | "none";

export function effectiveLlmStripHealth(input: {
  llmStatus: LlmStripHealthStatus;
  llmStatusDetail: string | null;
}): {
  status: LlmStripHealthStatus;
  detail: string | null;
  selectorLabel: string;
} {
  return {
    status: input.llmStatus,
    detail: input.llmStatusDetail,
    selectorLabel: "LLM",
  };
}
