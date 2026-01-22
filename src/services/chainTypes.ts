import type { ObjectId } from "mongodb";

/**
 * Chain execution status
 */
export type ChainStatus = "PENDING" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED";

/**
 * Available audit modes (corresponds to prompts/A-audit/ suites)
 */
/**
 * Available graph IDs
 */
export type GraphId = "audit" | "simple_react";

/**
 * Configuration for a single stage in a chain
 */
export interface AuditStageConfig {
    /** Unique identifier for this stage */
    id: string;
    /** Human-readable name */
    name: string;
    /** Which graph to run */
    graphId: GraphId;
    /** Path to the prompt file (repo-relative) */
    promptPath: string;
    /** LLM provider to use */
    llmProvider: "azure" | "lmstudio";
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
}

/**
 * A finding from a stage execution
 */
export interface Finding {
    /** Chain this finding belongs to */
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
 * Main chain entity stored in MongoDB
 */
export interface AuditChain {
    /** MongoDB ObjectId */
    _id?: ObjectId;
    /** Chain name */
    name: string;
    /** Optional description */
    description?: string;
    /** Current execution status */
    status: ChainStatus;
    /** When chain was created */
    createdAt: Date;
    /** When execution started */
    startedAt?: Date;
    /** When execution completed/failed */
    endedAt?: Date;
    /** Array of stages to execute */
    stages: AuditStageConfig[];
    /** Optional cron schedule */
    schedule?: CronSchedule;
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
    };
}

/**
 * A specific execution run of an audit campaign
 */
export interface AuditRun {
    /** MongoDB ObjectId */
    _id?: ObjectId;
    /** Reference to the campaign setup */
    chainId: ObjectId;
    /** Execution status */
    status: ChainStatus;
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
    };
}

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
    claims: any[];
    /** Generated tasks */
    tasks: any[];
    /** Execution duration in milliseconds */
    duration: number;
    /** Number of retry attempts */
    retries?: number;
}

/**
 * Result of full chain execution
 */
export interface ChainResult {
    /** Chain ID */
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

/**
 * Progress update during chain execution
 */
export interface ChainProgress {
    /** Chain ID */
    chainId: string;
    /** Current stage index */
    stageIndex: number;
    /** Stage status */
    status: "PENDING" | "RUNNING" | "SKIPPED" | "COMPLETED" | "FAILED";
    /** Current findings count */
    findings?: Finding[];
}

/**
 * Filter options for listing chains
 */
export interface ChainFilter {
    /** Filter by status */
    status?: ChainStatus;
    /** Search in name/description */
    search?: string;
    /** Only scheduled chains */
    scheduledOnly?: boolean;
}
