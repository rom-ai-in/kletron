/**
 * Per-workspace settings for structural + semantic context injection into agent prompts.
 */
export interface WorkspaceContextInjectionSettings {
  structuralInjectionEnabled: boolean;
  semanticInjectionEnabled: boolean;
  graphTopN: number;
  vectorTopN: number;
  tokenBudget: number;
  requireVectorIndexForAgent: boolean;
}

export const DEFAULT_WORKSPACE_CONTEXT_INJECTION: WorkspaceContextInjectionSettings = {
  structuralInjectionEnabled: true,
  semanticInjectionEnabled: true,
  graphTopN: 15,
  vectorTopN: 8,
  tokenBudget: 30000,
  requireVectorIndexForAgent: false,
};

export function normalizeWorkspaceContextInjection(
  raw: Partial<WorkspaceContextInjectionSettings> | null | undefined
): WorkspaceContextInjectionSettings {
  const d = DEFAULT_WORKSPACE_CONTEXT_INJECTION;
  if (!raw || typeof raw !== "object") return { ...d };
  return {
    structuralInjectionEnabled:
      typeof raw.structuralInjectionEnabled === "boolean" ? raw.structuralInjectionEnabled : d.structuralInjectionEnabled,
    semanticInjectionEnabled:
      typeof raw.semanticInjectionEnabled === "boolean" ? raw.semanticInjectionEnabled : d.semanticInjectionEnabled,
    graphTopN: typeof raw.graphTopN === "number" && raw.graphTopN > 0 ? Math.min(raw.graphTopN, 100) : d.graphTopN,
    vectorTopN: typeof raw.vectorTopN === "number" && raw.vectorTopN > 0 ? Math.min(raw.vectorTopN, 50) : d.vectorTopN,
    tokenBudget:
      typeof raw.tokenBudget === "number" && raw.tokenBudget > 0 ? Math.min(raw.tokenBudget, 200000) : d.tokenBudget,
    requireVectorIndexForAgent:
      typeof raw.requireVectorIndexForAgent === "boolean" ? raw.requireVectorIndexForAgent : d.requireVectorIndexForAgent,
  };
}
