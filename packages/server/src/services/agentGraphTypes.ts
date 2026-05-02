import type { ObjectId } from "mongodb";
import type { LlmProviderType } from "@kletron/shared/schemas/llmConfig.schema";
import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import type { TokenUsage, TokenUsageSummary } from "./tokenUsageTypes";
import type { AgentEvent } from "@kletron/shared/types";

export type AgentGraphStatus = "PENDING" | "RUNNING" | "PAUSED" | "CANCELLED" | "COMPLETED" | "FAILED";

export type AgentGraphNodeStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type AgentGraphLlmSelection = {
    provider: LlmProviderType;
    model?: string;
};

export type AgentGraphNodeReactConfig = {
    systemPrompt: string;
    /**
     * User prompt template. In v1 we support `{{state}}` which is replaced by
     * `JSON.stringify(currentState, null, 2)`.
     */
    userPromptTemplate: string;
    /** Tool allowlist (names must exist in MCP tool catalog). */
    toolNames: string[];
    /** Skill IDs to inject into this node's context. */
    skillIds?: string[];
    llmSelection?: AgentGraphLlmSelection;
    /** Future: enforce hard cap on tool calls. */
    maxToolCalls?: number;
    /**
     * If true, the agent will interrupt before executing tools so that a
     * human can review and approve the pending tool calls (human-in-the-loop).
     * Requires checkpointing to be enabled on the run.
     */
    interruptBeforeTools?: boolean;
};

export type AgentGraphNodeKind = "react" | "router" | "delegate";

export type AgentGraphNodeDelegateMode = "react" | "graph";

export type AgentGraphNodeDelegateConfig = {
    mode: AgentGraphNodeDelegateMode;
    /** When mode === "graph", execute this graph id as a sub-run. */
    graphId?: string;
    /** Optional summarization prompt for the delegate result. */
    summaryPrompt?: string;
    /** Optional model override for summary. */
    summaryLlmSelection?: AgentGraphLlmSelection;
};

export type AgentGraphNodeOutputConfig = {
    /**
     * Output schema registry key (e.g. `generic_json`, `phase1_output`, ...).
     * Validation happens at runtime after parsing assistant JSON output.
     */
    schemaId: string;
    /**
     * Optional state path to write the validated output into.
     * Example: "plan" or "quality.gates". "state." prefix is allowed.
     */
    statePath?: string;
    /**
     * If true and both existing value and output are objects, shallow-merge.
     */
    stateMerge?: boolean;
};

export type AgentGraphNode = {
    id: string;
    label: string;
    kind?: AgentGraphNodeKind;
    react: AgentGraphNodeReactConfig;
    delegate?: AgentGraphNodeDelegateConfig;
    output: AgentGraphNodeOutputConfig;
};

export type AgentGraphEdge = {
    id: string;
    source: string;
    target: string;
    /**
     * Optional condition expression evaluated against current state.
     * Examples: "state.nextStep == \"debug\"" or "exists(state.plan)".
     */
    condition?: string;
};

export type AgentGraphExecutionMode = "dag" | "state_machine";

export type AgentGraphExecutionConfig = {
    mode?: AgentGraphExecutionMode;
    /** Optional entry node for state machine mode. */
    entryNodeId?: string;
    /** Max total node executions in a run (loop guard). */
    maxIterations?: number;
    /** Max executions per node (loop guard). */
    maxNodeRuns?: number;
};

export interface AgentGraphDefinition {
    _id?: ObjectId;
    name: string;
    description?: string;
    category?: "deep_agent" | "graph" | "automation" | "drift" | "continuous_improvement" | "business_analysis";
    createdAt: Date;
    updatedAt: Date;
    nodes: AgentGraphNode[];
    edges: AgentGraphEdge[];
    execution?: AgentGraphExecutionConfig;
    /** Optional default state merged into initial run state. */
    stateDefaults?: Record<string, unknown>;
}

export type AgentGraphState = {
    mission?: string;
    userInput?: string;
    nodes: Record<string, unknown>;
    goal?: string;
    constraints?: string[];
    nonGoals?: string[];
    acceptanceCriteria?: string[];
    definitionOfDone?: string[];
    plan?: Record<string, unknown>;
    currentTaskId?: string;
    taskQueue?: unknown[];
    riskRegister?: unknown[];
    repoSummary?: string;
    envInfo?: Record<string, unknown>;
    buildCommands?: string[];
    constraintsDetected?: string[];
    workingNotes?: string[];
    designDecisions?: Array<Record<string, unknown>>;
    openQuestions?: string[];
    blockedReason?: string | null;
    consecutiveErrors?: number;
    toolCalls?: Array<Record<string, unknown>>;
    terminalRuns?: Array<Record<string, unknown>>;
    fileChanges?: Array<Record<string, unknown>>;
    testResults?: Record<string, unknown>;
    qualityGates?: Record<string, unknown>;
    reviewFeedback?: Array<Record<string, unknown>>;
    suggestedTests?: string[];
    approvals?: {
        pending?: Array<Record<string, unknown>>;
        granted?: Array<Record<string, unknown>>;
        rejected?: Array<Record<string, unknown>>;
    };
    confidence?: unknown;
    finalSummary?: string;
    nextSteps?: string[];
    route?: {
        next?: string;
        reason?: string;
    };
    execution?: {
        mode?: AgentGraphExecutionMode;
        step?: number;
        runsByNode?: Record<string, number>;
        history?: string[];
        lastNodeId?: string;
    };
    /** Accumulated conversation history for multi-turn sessions. */
    conversationHistory?: AgentEvent[];
    /**
     * Runtime-loaded skill slugs for this session (progressive disclosure via `load_skill` or slash preflight).
     * Order is significant: later entries override earlier ones when instructions conflict.
     * Merged into the system prompt **after** pinned graph `react.skillIds` (pinned first, then loaded).
     */
    loadedSkillIds?: string[];
    /** Optional audit trail for UI/debug when skills are loaded at runtime. */
    skillLoads?: Array<{ slug: string; at: string; reason?: string }>;
    /**
     * LangGraph checkpoint metadata — present when a run was interrupted
     * and is awaiting human approval to resume.
     */
    checkpoint?: {
        /** LangGraph thread ID (format: `{runId}:{nodeId}`). */
        threadId?: string;
        /** The node that was interrupted. */
        nodeId?: string;
        /** ISO timestamp when the interrupt occurred. */
        interruptedAt?: string;
        /** Current checkpoint status. */
        status?: "awaiting_approval" | "approved" | "rejected";
        /** ISO timestamp when the human approved/rejected. */
        approvedAt?: string;
        /** The human's approval message. */
        approvalMessage?: string;
        /**
         * FNV-1a hash of the graph definition (nodes + edges) at checkpoint time.
         * Used to detect incompatible graph changes between interrupt and resume.
         */
        graphHash?: string;
    };
};

export interface AgentGraphRun {
    _id?: ObjectId;
    graphId: ObjectId;
    workspaceId?: ObjectId;
    /** Origin of this run: "agent" (UI), "automation", "api", "cli", etc. */
    source?: string;
    /** Authenticated user who started this run (used for per-tenant tool approval). */
    createdByUserId?: string;
    status: AgentGraphStatus;
    startedAt: Date;
    endedAt?: Date;
    nodeOrder: string[];
    nodeSessionIds: Record<string, string>;
    nodeStatuses: Record<string, AgentGraphNodeStatus>;
    /** Per-node token usage tracking */
    nodeTokenUsage?: Record<string, TokenUsage>;
    /** Run-level aggregated token usage */
    tokenUsage?: TokenUsageSummary;
    state: AgentGraphState;
    error?: string;
    /** Session title (auto-generated or user-set). */
    title?: string;
    /** Whether this session has been archived. */
    archived?: boolean;
    /** Number of multi-turn conversation turns. */
    conversationTurns?: number;
    /** Whether this run has an active LangGraph checkpoint (for resume). */
    hasCheckpoint?: boolean;
    /** Links this thread back to the automation config that triggered it. */
    automationId?: ObjectId;
    /** When set, this run is a hidden sub-stage execution of `parentRunId`. */
    parentRunId?: ObjectId;
    /** Stage index for automation runs: 0 for the main thread, i for sub-runs. */
    stageIndex?: number;
    /** Per-stage results aggregated on the main automation thread. */
    automationStageResults?: AutomationStageRunResult[];
    /**
     * Per-thread approval policy for interactive agent runs.
     * Omitted or `inherit` uses workspace tool approval only.
     */
    threadApprovalMode?: ThreadApprovalMode;
    /** Code vs Work mode for tool allowlists and prompting (default `code`). */
    workMode?: "code" | "work";
}

/**
 * Per-stage outcome stored on the main automation thread (`stageIndex === 0`).
 * Replaces the legacy `audit_runs.stageResults` field.
 */
export type AutomationStageRunResult = {
    stageId: string;
    stageName: string;
    stageIndex: number;
    /** Sub-run ID for stages 1..N (the main thread itself executes stage 0). */
    subRunId?: string;
    success: boolean;
    error?: string;
    errorKind?: string;
    findingsCount?: number;
    claimsCount?: number;
    tasksCount?: number;
    rawOutput?: string;
    duration: number;
};
