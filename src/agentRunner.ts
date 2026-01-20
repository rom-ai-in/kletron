import { BaseMessage } from "@langchain/core/messages";

import {
  phaseDefinitions,
  phaseOrder,
  runPhase1MapperAgent,
  runPhase2AuditorAgent,
  runPhase3PlannerAgent,
  runPhase4ReporterAgent,
} from "./agents/phases.ts";

type TimelineStatus = "pending" | "running" | "success" | "error";

export type TimelineEvent = {
  id: string;
  label: string;
  status: TimelineStatus;
  summary: string;
  details?: string;
  systemPrompt?: string;
  thoughtLog?: string[];
  startedAt?: string;
  endedAt?: string;
};

export type AgentWorkflowResult = {
  timeline: TimelineEvent[];
  conclusion: string;
  outputs: {
    meta: Record<string, unknown>;
    findings: unknown[];
    tasks: unknown[];
    report: string;
  };
};

function formatSummary(value: unknown) {
  if (!value) return "No data available yet.";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatThought(message: BaseMessage) {
  const role = "role" in message ? message.role : message.type ?? "assistant";
  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content ?? "", null, 2);
  return `${role}: ${content}`;
}

function createInitialTimeline(): TimelineEvent[] {
  return phaseOrder.map((phaseId) => ({
    id: phaseId,
    label: phaseDefinitions[phaseId].label,
    status: "pending",
    summary: phaseDefinitions[phaseId].summary,
    details: phaseDefinitions[phaseId].description,
    systemPrompt: phaseDefinitions[phaseId].systemPrompt,
    thoughtLog: [],
  }));
}

async function runPhase<TReturn>(phaseId: keyof typeof phaseDefinitions, callback: () => Promise<TReturn>, timeline: TimelineEvent[]) {
  const event = timeline.find((entry) => entry.id === phaseId);
  if (!event) throw new Error(`Phase ${phaseId} missing from timeline`);

  event.status = "running";
  event.summary = `${phaseDefinitions[phaseId].summary} (running)`;
  event.startedAt = new Date().toISOString();

  try {
    const result = await callback();
    const messages = (result as { messages?: BaseMessage[] }).messages ?? [];
    event.thoughtLog = messages.map(formatThought);
    event.status = "success";
    event.summary = `${phaseDefinitions[phaseId].summary} (done)`;
    event.endedAt = new Date().toISOString();
    return result;
  } catch (error: unknown) {
    event.status = "error";
    event.summary = `Failed: ${(error as Error).message ?? "unknown error"}`;
    event.endedAt = new Date().toISOString();
    throw error;
  }
}

async function describeMeta(meta: Record<string, unknown>) {
  const highlights: string[] = [];
  if (meta.languages) {
    highlights.push(
      `Languages: ${
        Array.isArray(meta.languages) ? (meta.languages as string[]).join(", ") : meta.languages
      }`
    );
  }
  if (meta.frameworks) {
    highlights.push(
      `Frameworks: ${
        Array.isArray(meta.frameworks) ? (meta.frameworks as string[]).join(", ") : meta.frameworks
      }`
    );
  }
  if (meta.entrypoints) {
    highlights.push(
      `Entrypoints: ${
        Array.isArray(meta.entrypoints) ? (meta.entrypoints as string[]).join(", ") : meta.entrypoints
      }`
    );
  }
  if (meta.critical_areas) {
    highlights.push(`Critical areas: ${formatSummary(meta.critical_areas)}`);
  }
  if (!highlights.length) {
    highlights.push("Meta information was generated but no highlights were detected.");
  }
  return highlights.join(" · ");
}

export async function runAgentWorkflow(userRequest: string): Promise<AgentWorkflowResult> {
  const timeline = createInitialTimeline();

  const phase1Result = await runPhase("phase1", () => runPhase1MapperAgent(userRequest), timeline);
  const meta = (phase1Result.parsed as any)?.meta ?? {};
  const phase1Entry = timeline.find((entry) => entry.id === "phase1");
  if (phase1Entry) {
    phase1Entry.details = await describeMeta(meta);
  }

  const phase2Result = await runPhase("phase2", () =>
    runPhase2AuditorAgent({
      userRequest,
      meta,
      suggestedAuditFiles: (phase1Result.parsed as any)?.suggested_audit_files ?? [],
    })
  , timeline);
  const findingsSummary = (phase2Result.parsed as any)?.findings ?? [];
  const phase2Entry = timeline.find((entry) => entry.id === "phase2");
  if (phase2Entry) {
    phase2Entry.details =
      Array.isArray(findingsSummary) && findingsSummary.length
        ? `Findings captured: ${findingsSummary.length}`
        : "No findings were returned.";
  }

  const phase3Result = await runPhase("phase3", () =>
    runPhase3PlannerAgent({ userRequest, findings: findingsSummary })
  , timeline);
  const tasksSummary = (phase3Result.parsed as any)?.tasks ?? [];
  const phase3Entry = timeline.find((entry) => entry.id === "phase3");
  if (phase3Entry) {
    phase3Entry.details =
      Array.isArray(tasksSummary) && tasksSummary.length
        ? `Plan drafted with ${tasksSummary.length} tasks.`
        : "No actionable tasks were produced.";
  }

  const phase4Result = await runPhase(
    "phase4",
    () =>
      runPhase4ReporterAgent({
        userRequest,
        meta,
        findings: findingsSummary,
        tasks: tasksSummary,
      }),
    timeline
  );

  const reportMarkdown = (phase4Result.parsed as any)?.report_markdown ?? "";
  const finalSummary = reportMarkdown.split("\n").slice(0, 4).join(" ").trim();
  const phase4Entry = timeline.find((entry) => entry.id === "phase4");
  if (phase4Entry) {
    phase4Entry.summary = finalSummary || "Report generated.";
  }

  return {
    timeline,
    conclusion: finalSummary || "Pipeline completed successfully.",
    outputs: {
      meta,
      findings: findingsSummary,
      tasks: tasksSummary,
      report: reportMarkdown,
    },
  };
}
