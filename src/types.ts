import { BaseMessage } from "@langchain/core/messages";
import type { LlmProviderType } from "./schemas/llmConfig.schema";

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
    thoughts?: string[]; // Array of internal reasoning steps
    metadata?: Record<string, any>; // Generic metadata for future extensibility (e.g. valid actions)
    timestamp: string;
};

export type AgentWorkflowResult = {
    sessionId: string;
    timeline: TimelineEvent[];
    conclusion: string;
    outputs: {
        context: any;
        target_files: any[];
        raw_claims: any[];
        verified_findings: any[];
        findings: any[];
        tasks: any[];
        report: string;
        meta?: Record<string, unknown>;
        stageMetrics?: StageMetric[];
        todo?: string[];
    };
    eventStream: AgentEvent[];
};

export type AgentWorkflowUpdate = {
    timeline: TimelineEvent[];
    eventStream: AgentEvent[];
    outputs?: AgentWorkflowResult["outputs"];
};

export type AgentWorkflowOptions = {
    onUpdate?: (update: AgentWorkflowUpdate) => Promise<void> | void;
    llmSelection?: { provider: LlmProviderType; model?: string };
    auditContext?: any | null;
};

export type RepoGraphNode = {
    id: string;
    label: string;
    type: "directory" | "file" | "root";
    path: string;
    parentId?: string; // For hierarchy
    data?: any; // Additional metadata (description, etc.)
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
