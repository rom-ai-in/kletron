import {
  Annotation,
  END,
  MessagesAnnotation,
  SingleReducer,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";

import { config } from "./config";
import { McpClient } from "./mcp/client";
import {
  runPhase1MapperAgent,
  runPhase2AuditorAgent,
  runPhase3PlannerAgent,
  runPhase4ReporterAgent,
} from "./agents/phases";

const ARTIFACTS_DIR = ".numezis";

const lastValueReducer = <ValueType>(
  defaultValue?: () => ValueType
): SingleReducer<ValueType, ValueType> => ({
  reducer: (_: ValueType, value: ValueType) => value,
  default: defaultValue,
});

const NumezisAnnotation = Annotation.Root({
  messages: MessagesAnnotation.spec.messages,
  userRequest: Annotation<string>(lastValueReducer<string>(() => "")),

  meta: Annotation<Record<string, unknown>>(
    lastValueReducer<Record<string, unknown>>(() => ({}))
  ),
  repoMapMarkdown: Annotation<string>(lastValueReducer<string>(() => "")),
  suggestedAuditFiles: Annotation<string[]>(
    lastValueReducer<string[]>(() => [])
  ),

  findings: Annotation<unknown[]>(
    lastValueReducer<unknown[]>(() => [])
  ),
  tasks: Annotation<unknown[]>(
    lastValueReducer<unknown[]>(() => [])
  ),

  reportMarkdown: Annotation<string>(lastValueReducer<string>(() => "")),
  outputs: Annotation<{ metaPath: string; tasksPath: string; reportPath: string }>(
    lastValueReducer<{ metaPath: string; tasksPath: string; reportPath: string }>(() => ({
      metaPath: `${ARTIFACTS_DIR}/meta.json`,
      tasksPath: `${ARTIFACTS_DIR}/tasks.json`,
      reportPath: `${ARTIFACTS_DIR}/report.md`,
    }))
  ),

  finalAnswer: Annotation<string>(lastValueReducer<string>(() => "")),
});

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((v) => typeof v === "string");
  return strings.length ? strings : undefined;
}

async function phase1Map(state: typeof NumezisAnnotation.State) {
  const result = await runPhase1MapperAgent(state.userRequest, state.messages ?? []);
  const parsed = (result.parsed ?? {}) as any;

  return {
    meta: parsed.meta ?? {},
    repoMapMarkdown: typeof parsed.repo_map_markdown === "string" ? parsed.repo_map_markdown : "",
    suggestedAuditFiles: getStringArray(parsed.suggested_audit_files) ?? [],
    messages: result.messages ?? [],
  };
}

async function phase2Audit(state: typeof NumezisAnnotation.State) {
  const result = await runPhase2AuditorAgent({
    userRequest: state.userRequest,
    meta: state.meta,
    suggestedAuditFiles: state.suggestedAuditFiles,
    extraMessages: state.messages ?? [],
  });

  return {
    findings: (result.parsed as any)?.findings ?? [],
    messages: result.messages ?? [],
  };
}

async function phase3Plan(state: typeof NumezisAnnotation.State) {
  const result = await runPhase3PlannerAgent({
    userRequest: state.userRequest,
    findings: state.findings,
    extraMessages: state.messages ?? [],
  });

  return {
    tasks: (result.parsed as any)?.tasks ?? [],
    messages: result.messages ?? [],
  };
}

async function phase4ReportAndWrite(state: typeof NumezisAnnotation.State) {
  const reportResult = await runPhase4ReporterAgent({
    userRequest: state.userRequest,
    meta: state.meta,
    findings: state.findings,
    tasks: state.tasks,
    extraMessages: state.messages ?? [],
  });

  const reportMarkdown =
    typeof (reportResult.parsed as any)?.report_markdown === "string"
      ? (reportResult.parsed as any).report_markdown
      : "";

  const client = await McpClient.getInstance();
  const { metaPath, tasksPath, reportPath } = state.outputs;

  await client.callTool("write_file", {
    filePath: metaPath,
    content: JSON.stringify(state.meta ?? {}, null, 2),
    createDirs: true,
    overwrite: true,
  });
  await client.callTool("write_file", {
    filePath: tasksPath,
    content: JSON.stringify(state.tasks ?? [], null, 2),
    createDirs: true,
    overwrite: true,
  });

  const repoMapSection = state.repoMapMarkdown?.trim();
  const reportWithRepoMap = repoMapSection
    ? reportMarkdown.includes("## Repo map")
      ? reportMarkdown.replace("## Repo map", repoMapSection)
      : [reportMarkdown.trim(), "", repoMapSection, ""].join("\n")
    : reportMarkdown;

  await client.callTool("write_file", {
    filePath: reportPath,
    content: reportWithRepoMap,
    createDirs: true,
    overwrite: true,
  });

  const summary = [
    "✅ Pipeline complete.",
    `Artifacts written to: ${ARTIFACTS_DIR}/`,
    `- ${metaPath}`,
    `- ${tasksPath}`,
    `- ${reportPath}`,
  ].join("\n");

  return {
    reportMarkdown: reportWithRepoMap,
    finalAnswer: summary,
    messages: [...(reportResult.messages ?? []), new AIMessage(summary)],
  };
}

const workflow = new StateGraph(NumezisAnnotation)
  .addNode("phase1_map", phase1Map)
  .addNode("phase2_audit", phase2Audit)
  .addNode("phase3_plan", phase3Plan)
  .addNode("phase4_report", phase4ReportAndWrite)
  .addEdge(START, "phase1_map")
  .addEdge("phase1_map", "phase2_audit")
  .addEdge("phase2_audit", "phase3_plan")
  .addEdge("phase3_plan", "phase4_report")
  .addEdge("phase4_report", END);

const compiledWorkflow = workflow.compile();
export const graph = compiledWorkflow.withConfig({
  recursionLimit: config.graphRecursionLimit,
});
