import { BaseMessage } from "@langchain/core/messages";
import type { LlmProviderType } from "./schemas/llmConfig.schema";
import type { DocumentContext } from "./documentContext";

export type TargetFile = {
    path: string;
    reason?: string;
    owner?: string;
};

export type Claim = {
    claim: string;
    evidence?: string;
    source?: string;
    confidence?: number;
};

export type Finding = {
    title: string;
    summary: string;
    severity?: "low" | "medium" | "high" | "critical";
    evidence?: string;
};

export type Task = {
    title: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    status?: "todo" | "in_progress" | "done";
};

export type TimelineStatus = "pending" | "running" | "success" | "error";

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
    tokenUsage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
};

export type StageMetric = {
    stageId: string;
    stageLabel: string;
    findings: number;
    claims: number;
    verified: number;
};

export type AgentEventKind = "system" | "user" | "assistant" | "tool";

export type AgentEvent = {
    id: string;
    phaseId: string;
    phaseLabel?: string;
    kind: AgentEventKind;
    role: string;
    name?: string;
    toolName?: string;
    toolCallId?: string;
    content: string;
    toolNote?: string;
    toolArgs?: string;
    toolOutput?: string; // Result of the tool execution
    isError?: boolean; // Whether this tool result is an error
    thoughts?: string[]; // Array of internal reasoning steps
    metadata?: Record<string, any>; // Generic metadata for future extensibility (e.g. valid actions)
    timestamp: string;
};

export type AgentWorkflowResult = {
    sessionId: string;
    timeline: TimelineEvent[];
    conclusion: string;
    outputs: {
        context: DocumentContext;
        target_files: TargetFile[];
        raw_claims: Claim[];
        verified_findings: Finding[] | { total: number; by_severity: Record<"low"|"medium"|"high"|"critical", number>; items: Finding[] };
        findings: Finding[];
        tasks: Task[];
        report: string | {
            markdown?: string;
            json?: string;
            summary?: string;
        };
        meta?: Record<string, unknown>;
        stageMetrics?: StageMetric[];
        todo?: string[];
        status?: "success" | "partial_success" | "failure" | "error";
        execution_metrics?: {
            success_rate: number;
            total_operations: number;
            failed_operations: number;
            token_usage?: {
                inputTokens: number;
                outputTokens: number;
                totalTokens: number;
            };
        };
    };
    eventStream: AgentEvent[];
};

export type AgentWorkflowUpdate = {
    timeline: TimelineEvent[];
    eventStream: AgentEvent[];
    outputs?: AgentWorkflowResult["outputs"];
};

export type AgentWorkflowAbortReason = "PAUSED" | "CANCELLED" | "TIMEOUT";

/**
 * Checkpoint metadata included in workflow results when a run is
 * interrupted (human-in-the-loop).
 */
export type CheckpointInfo = {
    /** LangGraph thread ID for resume. */
    threadId: string;
    /** The graph node where the interrupt occurred. */
    nodeId?: string;
    /** ISO timestamp of the interrupt. */
    interruptedAt: string;
    /** Current status of the checkpoint. */
    status: "awaiting_approval" | "approved" | "rejected";
};

export type AgentWorkflowOptions = {
    onUpdate?: (update: AgentWorkflowUpdate) => Promise<void> | void;
    llmSelection?: { provider: LlmProviderType; model?: string };
    workspaceId?: string;
    /** Origin tag written to the run record (e.g. "agent", "automation", "api"). */
    source?: string;
    shouldAbort?: () => Promise<AgentWorkflowAbortReason | null> | AgentWorkflowAbortReason | null;
};

export type RepoGraphNode = {
    id: string;
    label: string;
    type: "directory" | "file" | "root";
    path: string;
    parentId?: string; // For hierarchy
    data?: {
        description?: string;
        size?: number;
        language?: string;
        [key: string]: unknown;
    };
};

export type RepoGraphEdge = {
    id: string;
    source: string;
    target: string;
    type?: string;
};

export type RepoAnalysisResult = {
    nodes: RepoGraphNode[];
    edges: RepoGraphEdge[];
    structureContext: {
        mission: string;
        invariants: string[];
        techStack: string[];
        architectureType: string;
    };
};

/** Workspace summary for multi-project management (shared across web and desktop). */
export type WorkspaceSummary = {
    id: string;
    name: string;
    rootPath: string;
    repoUrl?: string;
    provider?: string;
    defaultBranch?: string;
    status?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    lastUsed?: string | Date;
};
