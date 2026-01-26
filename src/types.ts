import { BaseMessage } from "@langchain/core/messages";

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
    llmSelection?: { provider: "azure" | "lmstudio"; model?: string };
    auditContext?: any | null;
};
