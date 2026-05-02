import type { ObjectId } from "mongodb";
import type { LlmProviderType } from "@kletron/shared/schemas/llmConfig.schema";
import type { TokenUsage, TokenUsageSummary } from "@kletron/shared/tokenUsageTypes";

/**
 * Automation execution status
 */
export type AutomationStatus = "PENDING" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";

/** @deprecated Use AutomationStatus instead */
export type ChainStatus = AutomationStatus;

/**
 * Structured error classification for failed automation stages.
 * Used for diagnostics, notifications, and retry decisions.
 */
export type AutomationErrorKind = "LLM_TIMEOUT" | "LLM_ERROR" | "TOOL_BLOCKED" | "EVIDENCE_GATE" | "UNKNOWN";

/**
 * Graph ID — references an AgentGraphDefinition stored in MongoDB.
 * Runtime resolution: MongoDB ObjectId for DB-backed graphs, or legacy preset keys
 * (`audit`, `simple_react`, …) resolved server-side via `resolveGraphForStage`.
 * UI clients should persist only real graph document ids from `/api/agent-graphs`.
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
    /** Stage-level timeout in milliseconds (default: 600000 = 10 min) */
    timeoutMs?: number;
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
 * Main automation configuration entity stored in MongoDB
 * (Collection: audit_chains, kept for backward compatibility).
 *
 * Note: this document holds **only configuration**. Per-execution state
 * (status, timing, stage results, findings) lives on the corresponding
 * agent_graph_run documents that the executor creates per run.
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
    /** When automation was created */
    createdAt: Date;
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
}

/**
 * Filter options for listing automations
 */
export interface AutomationFilter {
    /** Search in name/description */
    search?: string;
    /** Only scheduled automations */
    scheduledOnly?: boolean;
    /** Filter by trigger type */
    triggerType?: AutomationTriggerType;
    /** Limit to a workspace */
    workspaceId?: string;
    /** @deprecated Status no longer lives on the config doc; ignored. */
    status?: AutomationStatus;
}
