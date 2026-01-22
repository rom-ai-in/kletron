import { z } from "zod";

// --- Enums & Common Types ---

export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const VerdictStatusSchema = z.enum([
    "VERIFIED",
    "REFUTED",
    "PLAUSIBLE",
    "REJECTED",
]);
export type VerdictStatus = z.infer<typeof VerdictStatusSchema>;

// --- Phase 1: Recon ---

export const Phase1OutputSchema = z.object({
    context: z.object({
        mission: z.string(),
        languages: z.array(z.string()),
        frameworks: z.array(z.string()),
        hotspots: z.array(z.string()),
    }),
});
export type Phase1Output = z.infer<typeof Phase1OutputSchema>;

// --- Phase 2: Strategy ---

export const TargetFileSchema = z.object({
    path: z.string(),
    focus_area: z.string(),
    score: z.number().min(0).max(100),
});
export type TargetFile = z.infer<typeof TargetFileSchema>;

export const Phase2OutputSchema = z.object({
    target_files: z.array(TargetFileSchema),
});
export type Phase2Output = z.infer<typeof Phase2OutputSchema>;

// --- Phase 3: Investigation ---

export const RawClaimSchema = z.object({
    id: z.string(),
    file_path: z.string(),
    line_start: z.number().int().positive(),
    line_end: z.number().int().positive(),
    snippet: z.string(),
    severity: SeveritySchema,
    description: z.string(),
    assumption: z.object({
        condition: z.string(),
        related_symbol: z.string().optional(),
    }),
});
export type RawClaim = z.infer<typeof RawClaimSchema>;

export const Phase3OutputSchema = z.object({
    raw_claims: z.array(RawClaimSchema),
});
export type Phase3Output = z.infer<typeof Phase3OutputSchema>;

// --- Phase 4: Adjudicator ---

export const VerdictSchema = z.object({
    claim_id: z.string(),
    status: VerdictStatusSchema,
    confidence_score: z.number().min(0).max(100),
    reasoning: z.string(),
    proof_trace: z.array(z.string()),
});
export type Verdict = z.infer<typeof VerdictSchema>;

export const Phase4OutputSchema = z.object({
    verdicts: z.array(VerdictSchema),
});
export type Phase4Output = z.infer<typeof Phase4OutputSchema>;

// --- Phase 5: Reporter ---

export const TaskTicketSchema = z.object({
    id: z.string(),
    title: z.string(),
    priority: z.string(),
    impact: z.string(),
    effort: z.string(),
    steps: z.array(z.string()),
    acceptance_criteria: z.array(z.string()),
});
export type TaskTicket = z.infer<typeof TaskTicketSchema>;

export const Phase5OutputSchema = z.object({
    report_markdown: z.string(),
    tasks: z.array(TaskTicketSchema),
});
export type Phase5Output = z.infer<typeof Phase5OutputSchema>;
