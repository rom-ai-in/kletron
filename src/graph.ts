import { Annotation, END, SingleReducer, START, StateGraph } from "@langchain/langgraph";

import { config } from "./config";
import { McpClient } from "./mcp/client";
import {
  runPhase1ReconAgent,
  runPhase2StrategyAgent,
  runPhase3InvestigationAgents,
  runPhase4AdjudicatorAgent,
  runPhase5ReporterAgent,
} from "./agents/phases";

const ARTIFACTS_DIR = ".numezis";

export type TaskTicket = {
  id: string;
  title: string;
  priority: string;
  impact: string;
  effort: string;
  steps: string[];
  acceptance_criteria: string[];
};

// The Global Graph State
export interface AuditState {
  // Phase 1: Context
  context: {
    mission: string; // User's goal: "Find security flaws in auth"
    languages: string[]; // e.g., ["TypeScript", "Python"]
    frameworks: string[]; // e.g., ["Next.js", "Prisma"]
    hotspots: string[]; // Files with high churn/complexity
  };

  // Phase 2: The Hit List
  target_files: Array<{
    path: string;
    focus_area: string; // Specific instruction for the investigator
    score: number; // Priority score (0-100)
  }>;

  // Phase 3: Raw Intelligence (Unverified)
  raw_claims: Array<{
    id: string;
    file_path: string;
    line_start: number;
    line_end: number;
    snippet: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    // The critical piece for verification:
    assumption: {
      condition: string; // e.g., "Input 'req.body' is not sanitized upstream"
      related_symbol?: string; // e.g., "processPayment"
    };
  }>;

  // Phase 4: The Truth (Verified)
  verified_findings: Array<{
    claim_id: string;
    status: "VERIFIED" | "REFUTED" | "PLAUSIBLE";
    verdict_reason: string; // e.g., "Traced input to validation middleware in auth.ts"
    final_severity: string;
  }>;

  // Phase 3 (normalized): Findings extracted from raw claims
  findings: Array<{
    type: "BLOQUANT" | "WARNING" | "INFO";
    file: string;
    description: string;
    line_start?: number;
    line_end?: number;
    claim_id?: string;
  }>;

  // Phase 5: Output
  report_markdown: string;
  tasks: Array<TaskTicket>;
}

const lastValueReducer = <ValueType>(
  defaultValue?: () => ValueType
): SingleReducer<ValueType, ValueType> => ({
  reducer: (_: ValueType, value: ValueType) => value,
  default: defaultValue,
});

const AuditAnnotation = Annotation.Root({
  context: Annotation<AuditState["context"]>(
    lastValueReducer<AuditState["context"]>(() => ({
      mission: "",
      languages: [],
      frameworks: [],
      hotspots: [],
    }))
  ),
  target_files: Annotation<AuditState["target_files"]>(
    lastValueReducer<AuditState["target_files"]>(() => [])
  ),
  raw_claims: Annotation<AuditState["raw_claims"]>(
    lastValueReducer<AuditState["raw_claims"]>(() => [])
  ),
  findings: Annotation<AuditState["findings"]>(
    lastValueReducer<AuditState["findings"]>(() => [])
  ),
  verified_findings: Annotation<AuditState["verified_findings"]>(
    lastValueReducer<AuditState["verified_findings"]>(() => [])
  ),
  report_markdown: Annotation<string>(lastValueReducer<string>(() => "")),
  tasks: Annotation<AuditState["tasks"]>(
    lastValueReducer<AuditState["tasks"]>(() => [])
  ),
  outputs: Annotation<{ metaPath: string; tasksPath: string; reportPath: string }>(
    lastValueReducer<{ metaPath: string; tasksPath: string; reportPath: string }>(() => ({
      metaPath: `${ARTIFACTS_DIR}/meta.json`,
      tasksPath: `${ARTIFACTS_DIR}/tasks.json`,
      reportPath: `${ARTIFACTS_DIR}/report.md`,
    }))
  ),
  finalAnswer: Annotation<string>(lastValueReducer<string>(() => "")),
});

async function phase1Recon(state: typeof AuditAnnotation.State) {
  const mission = state.context?.mission ?? "";
  const result = await runPhase1ReconAgent(mission || "Audit the repository");
  const parsed = (result.parsed ?? {}) as any;
  const parsedContext = parsed.context ?? {};
  const mergedContext = {
    mission:
      typeof parsedContext.mission === "string" && parsedContext.mission.trim()
        ? parsedContext.mission
        : mission || "Audit the repository",
    languages: Array.isArray(parsedContext.languages) ? parsedContext.languages : state.context.languages ?? [],
    frameworks: Array.isArray(parsedContext.frameworks) ? parsedContext.frameworks : state.context.frameworks ?? [],
    hotspots: Array.isArray(parsedContext.hotspots) ? parsedContext.hotspots : state.context.hotspots ?? [],
  };

  return {
    context: mergedContext,
  };
}

async function phase2Strategy(state: typeof AuditAnnotation.State) {
  const mission = state.context?.mission ?? "";
  const result = await runPhase2StrategyAgent({
    userRequest: mission,
    context: state.context,
  });

  return {
    target_files: (result.parsed as any)?.target_files ?? [],
  };
}

async function phase3Investigation(state: typeof AuditAnnotation.State) {
  const mission = state.context?.mission ?? "";
  const result = await runPhase3InvestigationAgents({
    userRequest: mission,
    targetFiles: state.target_files ?? [],
  });

  return {
    raw_claims: (result.parsed as any)?.raw_claims ?? [],
    findings: (result.parsed as any)?.findings ?? [],
  };
}

async function phase4Adjudication(state: typeof AuditAnnotation.State) {
  const verdicts: AuditState["verified_findings"] = [];
  for (const claim of state.raw_claims ?? []) {
    if (!claim || claim.severity === "low") continue;
    const verdictResult = await runPhase4AdjudicatorAgent({ claim });
    const parsed = (verdictResult.parsed as any)?.verdicts ?? [];
    const verdict = Array.isArray(parsed) ? parsed[0] : undefined;
    if (!verdict) continue;
    const status =
      verdict.status === "VERIFIED" || verdict.status === "REFUTED" || verdict.status === "PLAUSIBLE"
        ? verdict.status
        : verdict.status === "REJECTED"
        ? "REFUTED"
        : "PLAUSIBLE";
    verdicts.push({
      claim_id: verdict.claim_id ?? claim.id,
      status,
      verdict_reason: verdict.reasoning ?? "",
      final_severity: status === "REFUTED" ? "none" : claim.severity ?? "medium",
    });
  }
  return { verified_findings: verdicts };
}

async function phase5ReportAndWrite(state: typeof AuditAnnotation.State) {
  const mission = state.context?.mission ?? "";
  const reportResult = await runPhase5ReporterAgent({
    userRequest: mission,
    context: state.context,
    verifiedFindings: state.verified_findings,
    rawClaims: state.raw_claims,
  });

  const reportMarkdown =
    typeof (reportResult.parsed as any)?.report_markdown === "string"
      ? (reportResult.parsed as any).report_markdown
      : "";
  const tasks =
    Array.isArray((reportResult.parsed as any)?.tasks) ? (reportResult.parsed as any).tasks : [];

  const client = await McpClient.getInstance();
  const { metaPath, tasksPath, reportPath } = state.outputs;

  await client.callTool("write_file", {
    filePath: metaPath,
    content: JSON.stringify(state.context ?? {}, null, 2),
    createDirs: true,
    overwrite: true,
  });
  await client.callTool("write_file", {
    filePath: tasksPath,
    content: JSON.stringify(tasks ?? [], null, 2),
    createDirs: true,
    overwrite: true,
  });
  await client.callTool("write_file", {
    filePath: reportPath,
    content: reportMarkdown,
    createDirs: true,
    overwrite: true,
  });

  const summary = [
    "✅ Diamond Flow audit complete.",
    `Artifacts written to: ${ARTIFACTS_DIR}/`,
    `- ${metaPath}`,
    `- ${tasksPath}`,
    `- ${reportPath}`,
  ].join("\n");

  return {
    report_markdown: reportMarkdown,
    tasks,
    finalAnswer: summary,
  };
}

const workflow = new StateGraph(AuditAnnotation)
  .addNode("phase1_recon", phase1Recon)
  .addNode("phase2_strategy", phase2Strategy)
  .addNode("phase3_investigation", phase3Investigation)
  .addNode("phase4_adjudication", phase4Adjudication)
  .addNode("phase5_report", phase5ReportAndWrite)
  .addEdge(START, "phase1_recon")
  .addEdge("phase1_recon", "phase2_strategy")
  .addEdge("phase2_strategy", "phase3_investigation")
  .addEdge("phase3_investigation", "phase4_adjudication")
  .addEdge("phase4_adjudication", "phase5_report")
  .addEdge("phase5_report", END);

const compiledWorkflow = workflow.compile();
export const graph = compiledWorkflow.withConfig({
  recursionLimit: config.graphRecursionLimit,
});
