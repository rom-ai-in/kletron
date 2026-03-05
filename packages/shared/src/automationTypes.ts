import type { ObjectId } from "mongodb";
import type { LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";
import type { TokenUsage, TokenUsageSummary } from "@numezis/shared/tokenUsageTypes";

/**
 * Automation execution status
 */
export type AutomationStatus = "PENDING" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";

/** @deprecated Use AutomationStatus instead */
export type ChainStatus = AutomationStatus;

/**
 * Graph ID — references an AgentGraphDefinition stored in MongoDB.
 * This is a string (typically a MongoDB ObjectId or a legacy preset key).
 */
export type GraphId = string;

/**
 * Configuration for a single stage in an automation
 */
export interface AutomationStageConfig {
    /** Unique identifier for this stage */
    id: string;
    /** Human-readable name */
    name: string;
    /** Custom user prompt for this stage (optional for presets that load prompts at runtime) */
    prompt?: string;
    /** Which graph to run */
    graphId: GraphId;
    /** LLM provider to use */
    llmProvider: LlmProviderType;
    /** Optional model override (defaults to env config) */
    llmModel?: string;
    /** Context from previous stages to include (e.g., ["stage-1.findings"]) */
    contextFromPreviousStages?: string[];
    /** JavaScript expression to evaluate; skip stage if true */
    skipIf?: string;
    /** Retry failed stage with fallback LLM */
    retryOnFailure?: boolean;
    /** Max retry attempts (default: 3) */
    maxRetries?: number;
    /** Override phase-specific settings */
    phaseOverrides?: {
        [phaseId: string]: {
            maxToolCalls?: number;
            timeoutMs?: number;
        };
    };
}

/** @deprecated Use AutomationStageConfig instead */
export type AuditStageConfig = AutomationStageConfig;

/**
 * How an automation is triggered
 */
export type AutomationTriggerType = "manual" | "schedule" | "webhook" | "git_event";

/**
 * Git event types that can trigger an automation
 */
export type GitEventType = "push" | "pull_request" | "tag";

/**
 * Cron schedule configuration
 */
export interface CronSchedule {
    /** Whether scheduling is enabled */
    enabled: boolean;
    /** Cron expression (e.g., "0 2 * * *" for 2 AM daily) */
    cron: string;
    /** Timezone (e.g., "Europe/Zurich") */
    timezone: string;
    /** Optional max number of runs (unlimited if not set) */
    maxRuns?: number;
    /** Number of times this schedule has executed */
    executionCount?: number;
    /** When the schedule last triggered a run */
    lastScheduledAt?: Date;
    /** When the next scheduled run is due */
    nextScheduledAt?: Date;
}

/**
 * Webhook trigger configuration
 */
export interface WebhookTriggerConfig {
    /** HMAC signing secret for verifying webhook payloads (optional — if omitted, verification is skipped) */
    secret?: string;
    /** Optional allowlist of IP addresses */
    allowedIps?: string[];
}

/**
 * Git event trigger configuration
 */
export interface GitEventTriggerConfig {
    /** Which git events trigger this automation */
    events: GitEventType[];
    /** Optional branch filter (glob patterns, e.g. ["main", "release/*"]) */
    branches?: string[];
    /** HMAC signing secret for verifying git webhook payloads (optional — if omitted, verification is skipped) */
    secret?: string;
}

/**
 * A claim discovered during investigation phase
 */
export interface Claim {
    /** Unique identifier for this claim */
    id: string;
    /** File path where the issue was found */
    file: string;
    /** Starting line number (optional) */
    lineStart?: number;
    /** Ending line number (optional) */
    lineEnd?: number;
    /** Description of the potential issue */
    description: string;
    /** Severity level */
    severity: "BLOQUANT" | "WARNING" | "INFO";
    /** Category of the claim (e.g., security, performance, maintainability) */
    category?: string;
    /** Evidence or code snippet supporting the claim */
    evidence?: string;
}

/**
 * A remediation task generated from findings
 */
export interface Task {
    /** Unique identifier for this task */
    id: string;
    /** Short title describing the task */
    title: string;
    /** Detailed description of what needs to be done */
    description: string;
    /** Priority level */
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    /** IDs of findings this task addresses */
    relatedFindingIds: string[];
    /** Estimated effort (e.g., "1h", "1d", "1w") */
    estimatedEffort?: string;
    /** Suggested fix or approach */
    suggestedFix?: string;
}

/**
 * Category of an improvement suggestion
 */
export type ImprovementCategory =
    | "feature"
    | "bug"
    | "ux"
    | "perf"
    | "security"
    | "refactor"
    | "deps"
    | "docs"
    | "testing";

/**
 * Effort size estimate
 */
export type EffortSize = "XS" | "S" | "M" | "L" | "XL";

/**
 * A structured improvement suggestion produced by continuous improvement automation
 */
export interface ImprovementSuggestion {
    /** Unique identifier for this suggestion */
    id: string;
    /** Category of the improvement */
    category: ImprovementCategory;
    /** Short title */
    title: string;
    /** Detailed description of the improvement */
    description: string;
    /** File paths affected */
    files: string[];
    /** Priority level */
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    /** Estimated effort */
    effort: EffortSize;
    /** Confidence score (0-100) */
    confidence: number;
    /** Whether the agent can auto-fix this without human intervention */
    autoFixable: boolean;
    /** Suggested fix or approach */
    suggestedFix?: string;
    /** Related GitHub issue numbers */
    relatedIssues?: number[];
}

/**
 * A file targeted for investigation
 */
export interface TargetFile {
    /** File path */
    path: string;
    /** Reason for targeting this file */
    reason?: string;
    /** Priority score (higher = more important) */
    priority?: number;
}

/**
 * Context passed between automation stages
 */
export interface AutomationContext {
    /** High-level mission or goal */
    mission?: string;
    /** Path to the repository being audited */
    repoPath?: string;
    /** Files targeted for investigation */
    targetFiles?: TargetFile[];
    /** Languages relevant to the audit */
    languages?: string[];
    /** Frameworks relevant to the audit */
    frameworks?: string[];
    /** Areas flagged as hotspots */
    hotspots?: string[];
    /** System invariants or rules to check */
    invariants?: string[];
    /** Technology stack information */
    techStack?: string[];
    /** Findings from previous stages */
    previousFindings?: Finding[];
    /** Improvement suggestions from continuous improvement automation */
    suggestions?: ImprovementSuggestion[];
    /** GitHub issues synced for correlation */
    githubIssues?: Array<{ number: number; title: string; labels: string[] }>;
}

/** @deprecated Use AutomationContext instead */
export type AuditContext = AutomationContext;

/**
 * A finding from a stage execution
 */
export interface Finding {
    /** Automation this finding belongs to (legacy DB field name) */
    chainId: string;
    /** Stage that produced this finding */
    stageId: string;
    /** Audit session ID */
    sessionId: string;
    /** Severity type */
    type: "BLOQUANT" | "WARNING" | "INFO";
    /** File path */
    file: string;
    /** Description of the finding */
    description: string;
    /** Starting line number (optional) */
    lineStart?: number;
    /** Ending line number (optional) */
    lineEnd?: number;
    /** Reference to the original claim ID */
    claimId?: string;
    /** Verification status from adjudication */
    verificationStatus?: "VERIFIED" | "REFUTED" | "PLAUSIBLE" | "REJECTED";
    /** When this finding was created */
    timestamp: Date;
}

/**
 * Cross-stage insight detected by aggregation
 */
export interface Insight {
    /** Unique identifier */
    id: string;
    /** Type of insight */
    type: "PATTERN" | "HOTSPOT" | "TREND" | "CORRELATION";
    /** Short title */
    title: string;
    /** Detailed description */
    description: string;
    /** IDs of related findings */
    relatedFindings: string[];
    /** Confidence score (0-100) */
    confidence: number;
    /** Priority level */
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Main automation entity stored in MongoDB
 * (Legacy collection name: audit_chains)
 */
export interface AutomationDefinition {
    /** MongoDB ObjectId */
    _id?: ObjectId;
    /** Workspace owning this automation */
    workspaceId?: ObjectId;
    /** Automation name */
    name: string;
    /** Optional description */
    description?: string;
    /** Current execution status */
    status: AutomationStatus;
    /** When automation was created */
    createdAt: Date;
    /** When execution started */
    startedAt?: Date;
    /** When execution completed/failed */
    endedAt?: Date;
    /** Array of stages to execute */
    stages: AutomationStageConfig[];
    /** How this automation is triggered (default: "manual") */
    triggerType?: AutomationTriggerType;
    /** Optional cron schedule (used when triggerType is "schedule") */
    schedule?: CronSchedule;
    /** Webhook trigger configuration (used when triggerType is "webhook") */
    webhookConfig?: WebhookTriggerConfig;
    /** Git event trigger configuration (used when triggerType is "git_event") */
    gitEventConfig?: GitEventTriggerConfig;
    /** Current stage index (0-based) */
    currentStageIndex: number;
    /** Array of session IDs (one per stage) */
    sessionIds: string[];
    /** Aggregated findings across all stages */
    aggregatedFindings: Finding[];
    /** Detected cross-stage insights */
    crossStageInsights: Insight[];
    /** Final aggregated report (markdown) */
    finalReport?: string;
    /** Execution metadata */
    metadata?: {
        /** Total execution time in milliseconds */
        totalDuration: number;
        /** Total claims investigated */
        totalClaims: number;
        /** Total verified claims */
        totalVerified: number;
        /** Total rejected claims */
        totalRejected: number;
        /** Total tokens consumed across all stages */
        totalTokens?: number;
        /** Detailed token usage breakdown */
        tokenUsage?: TokenUsageSummary;
    };
}

/** @deprecated Use AutomationDefinition instead */
export type AuditChain = AutomationDefinition;

/**
 * A specific execution run of an automation
 * (Legacy collection name: audit_runs)
 */
export interface AutomationRun {
    /** MongoDB ObjectId */
    _id?: ObjectId;
    /** Workspace owning this run */
    workspaceId?: ObjectId;
    /** Reference to the automation (legacy DB field name) */
    chainId: ObjectId;
    /** Execution status */
    status: AutomationStatus;
    /** When run started */
    startedAt: Date;
    /** When run ended */
    endedAt?: Date;
    /** Current stage index (0-based) */
    currentStageIndex: number;
    /** Array of session IDs (one per stage) */
    sessionIds: string[];
    /** Aggregated findings across stages */
    aggregatedFindings: Finding[];
    /** Detected cross-stage insights */
    crossStageInsights: Insight[];
    /** Final aggregated report */
    finalReport?: string;
    /** Execution metadata */
    metadata?: {
        totalDuration: number;
        totalClaims: number;
        totalVerified: number;
        totalRejected: number;
        /** Total tokens consumed across all stages */
        totalTokens?: number;
        /** Detailed token usage breakdown */
        tokenUsage?: TokenUsageSummary;
    };
}

/** @deprecated Use AutomationRun instead */
export type AuditRun = AutomationRun;

/**
 * Result of a single stage execution
 */
export interface StageResult {
    /** Stage ID */
    stageId: string;
    /** Stage name */
    stageName: string;
    /** Audit session ID created for this stage */
    sessionId: string;
    /** Whether stage succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Findings from this stage */
    findings: Finding[];
    /** Raw claims from investigation phase */
    claims: Claim[];
    /** Generated tasks */
    tasks: Task[];
    /** Raw report/output text from the workflow (used as fallback context between stages) */
    rawOutput?: string;
    /** Execution duration in milliseconds */
    duration: number;
    /** Number of retry attempts */
    retries?: number;
    /** Token usage for this stage */
    tokenUsage?: TokenUsage;
}

/**
 * Result of full automation execution
 */
export interface AutomationResult {
    /** Automation ID (legacy DB field name) */
    chainId: string;
    /** Overall success */
    success: boolean;
    /** Results from each stage */
    stages: StageResult[];
    /** Aggregation results */
    aggregation: {
        /** All findings */
        findings: Finding[];
        /** Detected insights */
        insights: Insight[];
        /** Final report */
        report: string;
        /** Stats */
        stats: {
            totalStages: number;
            totalFindings: number;
            criticalCount: number;
            warningCount: number;
        };
    };
}

/** @deprecated Use AutomationResult instead */
export type ChainResult = AutomationResult;

/**
 * Progress update during automation execution
 */
export interface AutomationProgress {
    /** Automation ID (legacy DB field name) */
    chainId: string;
    /** Current stage index */
    stageIndex: number;
    /** Stage status */
    status: "PENDING" | "RUNNING" | "SKIPPED" | "COMPLETED" | "FAILED";
    /** Current findings count */
    findings?: Finding[];
}

/** @deprecated Use AutomationProgress instead */
export type ChainProgress = AutomationProgress;

/**
 * Filter options for listing automations
 */
export interface AutomationFilter {
    /** Filter by status */
    status?: AutomationStatus;
    /** Search in name/description */
    search?: string;
    /** Only scheduled automations */
    scheduledOnly?: boolean;
    /** Filter by trigger type */
    triggerType?: AutomationTriggerType;
    /** Limit to a workspace */
    workspaceId?: string;
}

/** @deprecated Use AutomationFilter instead */
export type ChainFilter = AutomationFilter;
