export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TokenUsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  callCount: number;
  byModel: Record<string, TokenUsage>;
  byProvider: Record<string, TokenUsage>;
}
