import { z } from "zod";
import type { EffortSize } from "./automationTypes";

// ---------------------------------------------------------------------------
// Feature Types & Enums
// ---------------------------------------------------------------------------

/** Type of feature proposal */
export type FeatureType =
    | "new_feature"
    | "improvement"
    | "fix"
    | "optimization"
    | "innovation"
    | "competitive"
    | "technical_debt"
    | "compliance";

/** Lifecycle status of a feature proposal */
export type FeatureStatus =
    | "draft"
    | "analyzed"
    | "validated"
    | "rejected"
    | "planned"
    | "in_progress"
    | "shipped";

/** How the feature was originally sourced */
export type FeatureSource =
    | "ai_generated"
    | "competitive"
    | "market"
    | "user_feedback"
    | "manual";

/** Priority level */
export type PriorityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

// ---------------------------------------------------------------------------
// Feature Proposal
// ---------------------------------------------------------------------------

export interface FeatureProposal {
    /** Unique identifier */
    id: string;
    /** Workspace this feature belongs to */
    workspaceId?: string;

    // Core fields
    /** Feature title */
    title: string;
    /** Type of feature */
    type: FeatureType;
    /** Lifecycle status */
    status: FeatureStatus;
    /** How this feature was sourced */
    source: FeatureSource;

    // Description
    /** One or two sentence summary */
    summary: string;
    /** Detailed description (markdown) */
    description: string;
    /** User story in "As a X, I want Y, so that Z" format */
    userStory?: string;
    /** Acceptance criteria */
    acceptanceCriteria?: string[];

    // Targeting
    /** IDs of personas this feature targets */
    targetPersonas?: string[];

    // Scoring
    /** Business value rating */
    businessValue: PriorityLevel;
    /** Estimated effort */
    effort: EffortSize;
    /** Priority score 0-100 */
    priority: number;
    /** Confidence score 0-100 */
    confidenceScore: number;

    // Competitive
    /** How this feature compares to competitors */
    competitiveContext?: string;
    /** IDs of competitors that have this feature */
    competitors?: string[];
    /** Innovation score 0-100 */
    innovationScore?: number;

    // Impact
    /** Areas impacted (UX, Revenue, Retention, etc.) */
    impactAreas?: string[];
    /** Identified risks */
    risks?: string[];
    /** Dependencies on other features or tech */
    dependencies?: string[];

    // Technical hints
    /** Suggested implementation approach */
    suggestedApproach?: string;
    /** Files likely to be affected */
    affectedFiles?: string[];
    /** IDs of related features */
    relatedFeatureIds?: string[];

    // Metadata
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
    /** Automation run that generated this feature */
    analysisRunId?: string;
    /** Tags for categorization */
    tags?: string[];
}

// ---------------------------------------------------------------------------
// Competitive Matrix
// ---------------------------------------------------------------------------

export type CompetitiveStatus = "absent" | "basic" | "good" | "excellent";

export interface CompetitiveMatrixEntry {
    /** Feature area being compared */
    featureArea: string;
    /** Our current status */
    ourStatus: CompetitiveStatus;
    /** Status for each competitor (competitorId -> status) */
    competitors: Record<string, CompetitiveStatus>;
    /** Description of the gap */
    gap?: string;
    /** Opportunity identified */
    opportunity?: string;
}

// ---------------------------------------------------------------------------
// Market Analysis
// ---------------------------------------------------------------------------

export interface MarketAnalysis {
    /** Unique identifier */
    id: string;
    /** Workspace this analysis belongs to */
    workspaceId?: string;
    /** When this analysis was generated */
    createdAt: Date;

    // Market overview
    /** Market size description */
    marketSize?: string;
    /** Growth trend */
    growthTrend?: string;
    /** Key market trends */
    keyTrends: string[];
    /** Market opportunities */
    opportunities: string[];
    /** Market threats */
    threats: string[];

    // Competitive landscape
    /** Feature-by-feature competitive matrix */
    competitiveMatrix?: CompetitiveMatrixEntry[];
    /** Gaps in the market to exploit */
    marketGaps?: string[];

    // Recommendations
    /** Strategic recommendations */
    strategicRecommendations: string[];
    /** Quick wins to implement */
    quickWins: string[];
    /** Long-term strategic plays */
    longTermPlays: string[];

    /** Automation run that generated this analysis */
    analysisRunId?: string;
}

// ---------------------------------------------------------------------------
// Dashboard Summary
// ---------------------------------------------------------------------------

export interface BADashboardSummary {
    /** Total number of feature proposals */
    totalFeatures: number;
    /** Feature count by type */
    byType: Record<FeatureType, number>;
    /** Feature count by status */
    byStatus: Record<FeatureStatus, number>;
    /** Feature count by priority level */
    byPriority: { critical: number; high: number; medium: number; low: number };
    /** Top priority features */
    topPriorityFeatures: FeatureProposal[];
    /** When the last analysis was run */
    lastAnalysis?: Date;
    /** Overall competitive score (0-100) */
    competitiveScore?: number;
    /** Overall innovation score (0-100) */
    innovationScore?: number;
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

export interface FeatureFilter {
    /** Filter by feature type */
    type?: FeatureType;
    /** Filter by status */
    status?: FeatureStatus;
    /** Filter by source */
    source?: FeatureSource;
    /** Free-text search */
    search?: string;
    /** Filter by persona ID */
    personaId?: string;
    /** Minimum priority score */
    minPriority?: number;
}

// ---------------------------------------------------------------------------
// Zod Schemas for API Validation
// ---------------------------------------------------------------------------

export const FEATURE_TYPES: FeatureType[] = [
    "new_feature", "improvement", "fix", "optimization",
    "innovation", "competitive", "technical_debt", "compliance",
];

export const FEATURE_STATUSES: FeatureStatus[] = [
    "draft", "analyzed", "validated", "rejected",
    "planned", "in_progress", "shipped",
];

export const FEATURE_SOURCES: FeatureSource[] = [
    "ai_generated", "competitive", "market", "user_feedback", "manual",
];

export const PRIORITY_LEVELS: PriorityLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const EFFORT_SIZES: EffortSize[] = ["XS", "S", "M", "L", "XL"];

export const FeatureProposalCreateSchema = z.object({
    title: z.string().min(1).max(500),
    type: z.enum(FEATURE_TYPES as [FeatureType, ...FeatureType[]]),
    status: z.enum(FEATURE_STATUSES as [FeatureStatus, ...FeatureStatus[]]).default("draft"),
    source: z.enum(FEATURE_SOURCES as [FeatureSource, ...FeatureSource[]]).default("manual"),
    summary: z.string().min(1).max(2000),
    description: z.string().min(1).max(50000),
    userStory: z.string().max(2000).optional(),
    acceptanceCriteria: z.array(z.string().min(1)).optional(),
    targetPersonas: z.array(z.string().min(1)).optional(),
    businessValue: z.enum(PRIORITY_LEVELS as [PriorityLevel, ...PriorityLevel[]]),
    effort: z.enum(EFFORT_SIZES as [EffortSize, ...EffortSize[]]),
    priority: z.number().min(0).max(100),
    confidenceScore: z.number().min(0).max(100),
    competitiveContext: z.string().max(5000).optional(),
    competitors: z.array(z.string().min(1)).optional(),
    innovationScore: z.number().min(0).max(100).optional(),
    impactAreas: z.array(z.string().min(1)).optional(),
    risks: z.array(z.string().min(1)).optional(),
    dependencies: z.array(z.string().min(1)).optional(),
    suggestedApproach: z.string().max(10000).optional(),
    affectedFiles: z.array(z.string().min(1)).optional(),
    relatedFeatureIds: z.array(z.string().min(1)).optional(),
    analysisRunId: z.string().optional(),
    tags: z.array(z.string().min(1)).optional(),
});

export const FeatureProposalUpdateSchema = FeatureProposalCreateSchema.partial();

export const FeatureFilterSchema = z.object({
    type: z.enum(FEATURE_TYPES as [FeatureType, ...FeatureType[]]).optional(),
    status: z.enum(FEATURE_STATUSES as [FeatureStatus, ...FeatureStatus[]]).optional(),
    source: z.enum(FEATURE_SOURCES as [FeatureSource, ...FeatureSource[]]).optional(),
    search: z.string().max(200).optional(),
    personaId: z.string().optional(),
    minPriority: z.number().min(0).max(100).optional(),
});

export const MarketAnalysisCreateSchema = z.object({
    marketSize: z.string().max(2000).optional(),
    growthTrend: z.string().max(2000).optional(),
    keyTrends: z.array(z.string().min(1)).default([]),
    opportunities: z.array(z.string().min(1)).default([]),
    threats: z.array(z.string().min(1)).default([]),
    competitiveMatrix: z.array(z.object({
        featureArea: z.string().min(1),
        ourStatus: z.enum(["absent", "basic", "good", "excellent"]),
        competitors: z.record(z.enum(["absent", "basic", "good", "excellent"])),
        gap: z.string().optional(),
        opportunity: z.string().optional(),
    })).optional(),
    marketGaps: z.array(z.string().min(1)).optional(),
    strategicRecommendations: z.array(z.string().min(1)).default([]),
    quickWins: z.array(z.string().min(1)).default([]),
    longTermPlays: z.array(z.string().min(1)).default([]),
    analysisRunId: z.string().optional(),
});
