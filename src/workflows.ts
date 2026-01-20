import { runAgentWorkflow, type AgentWorkflowOptions, type AgentWorkflowResult } from "./agentRunner";
import { runDeepResearchWorkflow } from "./deepResearch";
import { runSimpleReactWorkflow } from "./reactAgentWorkflow";
import { simpleReactGraphId } from "./shared/reactAgentConfig";
import type { GraphId } from "./shared/graphCatalog";

export const normalizeGraphId = (value?: string): GraphId => {
  if (!value) return "audit";
  const normalized = value.trim().toLowerCase();
  if (normalized === "deep_research" || normalized === "deep-research" || normalized === "deepresearch") {
    return "deep_research";
  }
  if (normalized === simpleReactGraphId || normalized === "react" || normalized === "simple_react") {
    return simpleReactGraphId;
  }
  return "audit";
};

export async function runWorkflow(
  message: string,
  graphId?: string,
  options?: AgentWorkflowOptions
): Promise<AgentWorkflowResult> {
  const resolvedGraph = normalizeGraphId(graphId);
  if (resolvedGraph === "deep_research") {
    return runDeepResearchWorkflow(message, options);
  }
  if (resolvedGraph === simpleReactGraphId) {
    return runSimpleReactWorkflow(message, options);
  }
  return runAgentWorkflow(message, options);
}
