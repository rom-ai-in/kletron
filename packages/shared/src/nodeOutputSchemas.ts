import { z } from "zod";

import {
    Phase1OutputSchema,
    Phase2OutputSchema,
    Phase3OutputSchema,
    Phase4OutputSchema,
    Phase5OutputSchema,
    Phase6OutputSchema,
} from "./agentSchemas";

export type NodeOutputSchemaId =
    | "generic_json"
    | "phase1_output"
    | "phase2_output"
    | "phase3_output"
    | "phase4_output"
    | "phase5_output"
    | "phase6_output"
    | "cursor_intake_output"
    | "cursor_spec_output"
    | "cursor_repo_scan_output"
    | "cursor_planner_output"
    | "cursor_route_output"
    | "cursor_researcher_output"
    | "cursor_coder_output"
    | "cursor_policy_output"
    | "cursor_verify_fast_output"
    | "cursor_verify_full_output"
    | "cursor_debugger_output"
    | "cursor_reviewer_output"
    | "cursor_refactor_output"
    | "cursor_final_gate_output"
    | "cursor_done_output";

export const GenericJsonObjectSchema = z.record(z.any());

const stringArray = z.array(z.string()).default([]);
const anyArray = z.array(z.any()).default([]);
const anyRecord = z.record(z.any()).default({});

export const CursorIntakeOutputSchema = z.object({
    goal: z.string().default(""),
    constraints: stringArray,
    openQuestions: stringArray,
    nonGoals: stringArray,
    userInput: z.string().default(""),
}).strip();

export const CursorSpecOutputSchema = z.object({
    acceptanceCriteria: stringArray,
    definitionOfDone: stringArray,
}).strip();

export const CursorRepoScanOutputSchema = z.object({
    repoSummary: z.string().default(""),
    envInfo: anyRecord,
    buildCommands: stringArray,
    constraintsDetected: stringArray,
}).strip();

export const CursorPlannerOutputSchema = z.object({
    plan: anyRecord,
    taskQueue: anyArray,
    currentTaskId: z.string().default(""),
    riskRegister: anyArray,
}).strip();

export const CursorRouteOutputSchema = z.object({
    route: z
        .object({
            next: z
                .enum(["researcher", "coder", "reviewer", "debugger", "final_gate"])
                .default("final_gate"),
            reason: z.string().default(""),
        })
        .default({ next: "final_gate", reason: "" }),
}).strip();

export const CursorResearcherOutputSchema = z.object({
    workingNotes: stringArray,
    openQuestions: stringArray,
    blockedReason: z.string().nullable().default(null),
    consecutiveErrors: z.number().default(0),
}).strip();

export const CursorCoderOutputSchema = z.object({
    fileChanges: anyArray,
    workingNotes: stringArray,
    taskQueue: anyArray,
    currentTaskId: z.string().default(""),
}).strip();

export const CursorPolicyOutputSchema = z.object({
    reviewFeedback: anyArray,
    route: z
        .object({
            next: z.enum(["coder", "verify_fast"]).default("verify_fast"),
            reason: z.string().default(""),
        })
        .default({ next: "verify_fast", reason: "" }),
}).strip();

export const CursorVerifyFastOutputSchema = z.object({
    testResults: anyRecord,
    qualityGates: anyRecord,
    route: z
        .object({
            next: z.enum(["verify_full", "debugger"]).default("verify_full"),
            reason: z.string().default(""),
        })
        .default({ next: "verify_full", reason: "" }),
}).strip();

export const CursorVerifyFullOutputSchema = z.object({
    testResults: anyRecord,
    qualityGates: anyRecord,
    route: z
        .object({
            next: z.enum(["reviewer", "debugger"]).default("reviewer"),
            reason: z.string().default(""),
        })
        .default({ next: "reviewer", reason: "" }),
}).strip();

export const CursorDebuggerOutputSchema = z.object({
    reviewFeedback: anyArray,
    taskQueue: anyArray,
    workingNotes: stringArray,
    currentTaskId: z.string().default(""),
    route: z
        .object({
            next: z.enum(["coder"]).default("coder"),
            reason: z.string().default(""),
        })
        .default({ next: "coder", reason: "" }),
}).strip();

export const CursorReviewerOutputSchema = z.object({
    reviewFeedback: anyArray,
    confidence: z.union([z.string(), z.number()]).default(""),
    suggestedTests: stringArray,
    route: z
        .object({
            next: z.enum(["coder", "refactor", "final_gate"]).default("final_gate"),
            reason: z.string().default(""),
        })
        .default({ next: "final_gate", reason: "" }),
}).strip();

export const CursorRefactorOutputSchema = z.object({
    fileChanges: anyArray,
    workingNotes: stringArray,
}).strip();

export const CursorFinalGateOutputSchema = z.object({
    finalSummary: z.string().default(""),
    nextSteps: stringArray,
    route: z
        .object({
            next: z.enum(["done", "planner", "coder"]).default("done"),
            reason: z.string().default(""),
        })
        .default({ next: "done", reason: "" }),
}).strip();

export const CursorDoneOutputSchema = z.object({
    finalSummary: z.string().default(""),
    nextSteps: stringArray,
}).strip();

export const nodeOutputSchemaRegistry: Record<NodeOutputSchemaId, z.ZodTypeAny> = {
    generic_json: GenericJsonObjectSchema,
    phase1_output: Phase1OutputSchema,
    phase2_output: Phase2OutputSchema,
    phase3_output: Phase3OutputSchema,
    phase4_output: Phase4OutputSchema,
    phase5_output: Phase5OutputSchema,
    phase6_output: Phase6OutputSchema,
    cursor_intake_output: CursorIntakeOutputSchema,
    cursor_spec_output: CursorSpecOutputSchema,
    cursor_repo_scan_output: CursorRepoScanOutputSchema,
    cursor_planner_output: CursorPlannerOutputSchema,
    cursor_route_output: CursorRouteOutputSchema,
    cursor_researcher_output: CursorResearcherOutputSchema,
    cursor_coder_output: CursorCoderOutputSchema,
    cursor_policy_output: CursorPolicyOutputSchema,
    cursor_verify_fast_output: CursorVerifyFastOutputSchema,
    cursor_verify_full_output: CursorVerifyFullOutputSchema,
    cursor_debugger_output: CursorDebuggerOutputSchema,
    cursor_reviewer_output: CursorReviewerOutputSchema,
    cursor_refactor_output: CursorRefactorOutputSchema,
    cursor_final_gate_output: CursorFinalGateOutputSchema,
    cursor_done_output: CursorDoneOutputSchema,
};

export const nodeOutputSchemaOptions: Array<{ id: NodeOutputSchemaId; label: string }> = [
    { id: "generic_json", label: "Generic JSON object" },
    { id: "phase1_output", label: "Phase 1 output" },
    { id: "phase2_output", label: "Phase 2 output" },
    { id: "phase3_output", label: "Phase 3 output" },
    { id: "phase4_output", label: "Phase 4 output" },
    { id: "phase5_output", label: "Phase 5 output" },
    { id: "phase6_output", label: "Phase 6 output" },
    { id: "cursor_intake_output", label: "Cursor intake output" },
    { id: "cursor_spec_output", label: "Cursor spec output" },
    { id: "cursor_repo_scan_output", label: "Cursor repo scan output" },
    { id: "cursor_planner_output", label: "Cursor planner output" },
    { id: "cursor_route_output", label: "Cursor route output" },
    { id: "cursor_researcher_output", label: "Cursor researcher output" },
    { id: "cursor_coder_output", label: "Cursor coder output" },
    { id: "cursor_policy_output", label: "Cursor policy output" },
    { id: "cursor_verify_fast_output", label: "Cursor verify fast output" },
    { id: "cursor_verify_full_output", label: "Cursor verify full output" },
    { id: "cursor_debugger_output", label: "Cursor debugger output" },
    { id: "cursor_reviewer_output", label: "Cursor reviewer output" },
    { id: "cursor_refactor_output", label: "Cursor refactor output" },
    { id: "cursor_final_gate_output", label: "Cursor final gate output" },
    { id: "cursor_done_output", label: "Cursor done output" },
];
