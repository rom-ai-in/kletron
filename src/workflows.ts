import { runAgentWorkflow, type AgentWorkflowOptions, type AgentWorkflowResult } from "./agentRunner";
import { runSimpleReactWorkflow } from "./reactAgentWorkflow";
import { simpleReactGraphId } from "./shared/reactAgentConfig";
import type { GraphId } from "./shared/graphCatalog";

export const normalizeGraphId = (value?: string): GraphId => {
  if (!value) return "audit";
  const normalized = value.trim().toLowerCase();
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
  if (resolvedGraph === simpleReactGraphId) {
    return runSimpleReactWorkflow(message, options);
  }
  return runAgentWorkflow(message, options);
}
