import { BaseMessage } from "@langchain/core/messages";
import { tool as createTool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { AgentEvent, AgentEventKind, AgentWorkflowResult, AgentWorkflowUpdate, TimelineEvent, AgentWorkflowAbortReason, Finding } from "@numezis/shared/types";
import { enhanceWorkflowResult } from "@numezis/shared/reportUtils";
import { streamReactAgentMessages, AgentWorkflowAbortError } from "@numezis/agent-core/reactAgentRunner";
import { allMcpTools } from "@numezis/agent-core/tools/mcpTools";
import { agentGraphRunService } from "./agentGraphRunService";
import { agentGraphService } from "./agentGraphService";
import type { AgentGraphNode } from "./agentGraphTypes";
import type { LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";
import { nodeOutputSchemaRegistry } from "@numezis/shared/nodeOutputSchemas";
import { parseJsonOutput, renderUserPrompt } from "./agentGraphUtils";
import { evaluateCondition } from "./agentGraphConditions";
import { buildInitialState, getEntryNodeIds, getGraphNodeOrder, resolveExecutionMode } from "./agentGraphRuntime";
import { setNestedValue } from "./agentGraphState";
import { skillRegistry } from "@numezis/agent-core/skills/registry";
import { tokenUsageService } from "./tokenUsageService";
import { ObjectId } from "mongodb";
import { getAuditContextConfig } from "@numezis/server/services/auditContextService";
import { formatAuditContextPrompt, type AuditContext } from "@numezis/shared/documentContext";
import { agentMemoryService } from "./agentMemoryService";
import { SafeEditGate } from "./agent/SafeEditGate";

// --- Checkpoint Imports ---
import { getCheckpointSaver, hasCheckpoint, computeGraphHash, ensureCheckpointIndexes } from "./checkpointService";

// --- Context Management Imports ---
import { getContextGraphStore } from "@numezis/server/context/graph/ContextGraphStore";
import { ContextRanker } from "@numezis/server/context/graph/ContextRanker";
import { getEditorStateManager } from "@numezis/server/context/graph/EditorStateManager";
import { ContextScanner } from "@numezis/server/context/graph/ContextScanner";
import { getWorkspaceByIdUnsafe, listAllWorkspaces } from "./workspaceService";
import { runWithWorkspaceContext } from "@numezis/server/workspace/workspaceContext";


const cloneValue = <T>(value: T): T => {
    if (
        typeof (globalThis as typeof globalThis & { structuredClone?: typeof structuredClone })?.structuredClone ===
        "function"
    ) {
        return (globalThis as typeof globalThis & { structuredClone: typeof structuredClone }).structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
};

const safeEditGate = SafeEditGate.getInstance();

const TOOL_RESULT_EVICT_CHARS = Number.isFinite(Number.parseInt(process.env.TOOL_RESULT_EVICT_CHARS ?? "", 10))
    ? Number.parseInt(process.env.TOOL_RESULT_EVICT_CHARS ?? "", 10)
    : 80000;
const TOOL_RESULT_PREVIEW_CHARS = Number.isFinite(Number.parseInt(process.env.TOOL_RESULT_PREVIEW_CHARS ?? "", 10))
    ? Number.parseInt(process.env.TOOL_RESULT_PREVIEW_CHARS ?? "", 10)
    : 2000;

const stringifyToolResult = (raw: unknown): string => {
    if (typeof raw === "string") return raw;
    if (raw === undefined || raw === null) return "";
    try {
        return JSON.stringify(raw, null, 2);
    } catch {
        return String(raw);
    }
};

const normalizeMemoryPath = (rawPath: string): string | null => {
    const trimmed = rawPath.trim();
    if (!trimmed) return null;
    const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (withSlash === "/memories") return "/memories/";
    if (!withSlash.startsWith("/memories/")) return null;
    if (withSlash.includes("..")) return null;
    return withSlash;
};

const extractMemoryPath = (toolName: string, input: Record<string, unknown>): string | null => {
    if (!input || typeof input !== "object") return null;
    if (toolName === "list_files" && typeof input.path === "string") {
        return normalizeMemoryPath(input.path);
    }
    if ((toolName === "read_file" || toolName === "read_file_range" || toolName === "write_file") && typeof input.filePath === "string") {
        return normalizeMemoryPath(input.filePath);
    }
    return null;
};

const writeEvictedToolResult = async (opts: {
    rootDir: string;
    runId: string;
    nodeId: string;
    toolName: string;
    content: string;
}) => {
    const relativeDir = path.join(".numezis", "agent-cache", opts.runId);
    const dir = path.join(opts.rootDir, relativeDir);
    await mkdir(dir, { recursive: true });
    const safeTool = opts.toolName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${safeTool}-${opts.nodeId}-${randomUUID()}.txt`;
    const relativePath = path.join(relativeDir, fileName);
    const absPath = path.join(opts.rootDir, relativePath);
    await writeFile(absPath, opts.content, "utf8");
    return relativePath;
};

const maybeEvictToolResult = async (opts: {
    rootDir: string;
    runId: string;
    nodeId: string;
    toolName: string;
    rawResult: unknown;
}) => {
    const content = stringifyToolResult(opts.rawResult);
    if (!content || content.length <= TOOL_RESULT_EVICT_CHARS) {
        return content;
    }
    const relativePath = await writeEvictedToolResult({
        rootDir: opts.rootDir,
        runId: opts.runId,
        nodeId: opts.nodeId,
        toolName: opts.toolName,
        content,
    });
    const preview = content.slice(0, TOOL_RESULT_PREVIEW_CHARS);
    return [
        `Tool result exceeded ${TOOL_RESULT_EVICT_CHARS} chars and was evicted.`,
        `Saved to: ${relativePath}`,
        `Preview (first ${TOOL_RESULT_PREVIEW_CHARS} chars):`,
        preview,
    ].join("\n");
};

const describeMessageContent = (message: BaseMessage) => {
    if (typeof message.content === "string") {
        return message.content;
    }
    // Handle array content blocks (Claude format: [{type:"thinking",...},{type:"text",...}])
    if (Array.isArray(message.content)) {
        const textBlocks = (message.content as any[])
            .filter((block) => block?.type === "text" && typeof block.text === "string")
            .map((block) => block.text as string);
        if (textBlocks.length > 0) {
            return textBlocks.join("\n");
        }
        // Fallback: concatenate all string-like content, skip thinking blocks
        const allText = (message.content as any[])
            .filter((block) => block?.type !== "thinking")
            .map((block) => (typeof block === "string" ? block : block?.text ?? ""))
            .filter(Boolean)
            .join("\n");
        if (allText) return allText;
    }
    if ((message as any).text && typeof (message as any).text === "string" && (message as any).text.trim()) {
        return (message as any).text;
    }
    if (message.content) {
        try {
            return JSON.stringify(message.content, null, 2);
        } catch {
            return String(message.content);
        }
    }
    return "";
};

// ─── Thinking / Reasoning extraction ─────────────────────────────────────────

/**
 * Extract structured thinking from a LangChain BaseMessage.
 * Checks (in order):
 * 1. Array content blocks with type:"thinking" (Claude extended thinking)
 * 2. additional_kwargs fields (Claude thinking, OpenAI reasoning_content)
 * 3. <think> blocks in text content (any model)
 * Returns raw thinking strings (one per source block found).
 */
function extractThinkingFromMessage(message: BaseMessage): string[] {
    const thoughts: string[] = [];

    // 1. Array content blocks (Claude extended thinking format)
    if (Array.isArray(message.content)) {
        for (const block of message.content as any[]) {
            if (block?.type === "thinking" && typeof block.thinking === "string" && block.thinking.trim()) {
                thoughts.push(block.thinking.trim());
            }
        }
    }

    // 2. additional_kwargs — provider-specific thinking fields
    const kwargs = (message as any).additional_kwargs;
    if (kwargs && typeof kwargs === "object") {
        // Anthropic / Claude
        if (typeof kwargs.thinking === "string" && kwargs.thinking.trim()) {
            thoughts.push(kwargs.thinking.trim());
        }
        // OpenAI reasoning models (o1, o3, etc.)
        if (typeof kwargs.reasoning_content === "string" && kwargs.reasoning_content.trim()) {
            thoughts.push(kwargs.reasoning_content.trim());
        }
        if (typeof kwargs.reasoning === "string" && kwargs.reasoning.trim() && !thoughts.some(t => t === kwargs.reasoning.trim())) {
            thoughts.push(kwargs.reasoning.trim());
        }
    }

    // 3. <think> blocks in text content (any model that embeds reasoning in tags)
    const textContent = typeof message.content === "string" ? message.content : "";
    if (textContent) {
        const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
        let match: RegExpExecArray | null;
        while ((match = thinkRegex.exec(textContent)) !== null) {
            if (match[1].trim()) {
                thoughts.push(match[1].trim());
            }
        }
    }

    return thoughts;
}

/**
 * Heuristic extraction of reasoning from plain-text assistant content.
 * Applied when no structured thinking was found. Looks for:
 * - "Final:" / "Answer:" markers (text before → thoughts, text after → cleaned content)
 * - First paragraph with reasoning cue words (split it into thoughts)
 * Returns the cleaned content and extracted thought strings.
 */
function extractThoughtsFromContent(content: string): { content: string; thoughts: string[] } {
    if (!content) return { content, thoughts: [] };

    const thoughts: string[] = [];
    let cleaned = content;

    const addThoughts = (block: string) => {
        const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const bulletLines = lines.filter((line) => /^([-*]|\d+\.|\d+\))\s+/.test(line));
        if (bulletLines.length > 0) {
            bulletLines.forEach((line) => {
                thoughts.push(line.replace(/^([-*]|\d+\.|\d+\))\s+/, "").trim());
            });
            return;
        }
        if (lines.length > 1) {
            thoughts.push(...lines);
            return;
        }
        if (block.trim()) {
            thoughts.push(block.trim());
        }
    };

    // Strip <think> blocks (already extracted by extractThinkingFromMessage)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Split on explicit Final/Answer markers
    const finalRegex = /(?:^|\n)\s*(final|answer)\s*:\s*/i;
    const finalMatch = cleaned.match(finalRegex);
    if (finalMatch && finalMatch.index !== undefined) {
        const before = cleaned.slice(0, finalMatch.index).trim();
        const after = cleaned.slice(finalMatch.index + finalMatch[0].length).trim();
        if (after && before) {
            addThoughts(before);
            cleaned = after;
        }
    }

    // Heuristic: if first paragraph looks like reasoning, split it out
    const cueRegex = /\b(we need to|we should|we have|the user|user wants|goal|plan|approach|next step|tool|call|let's|i will)\b/i;
    const paragraphs = cleaned.split(/\n\s*\n/);
    if (paragraphs.length >= 2) {
        const first = paragraphs[0].trim();
        const rest = paragraphs.slice(1).join("\n\n").trim();
        if (rest && cueRegex.test(first)) {
            addThoughts(first);
            cleaned = rest;
        }
    }

    // Safeguard: don't blank out content completely
    if (!cleaned.trim() && thoughts.length > 0) {
        cleaned = content.trim();
    }

    return { content: cleaned, thoughts };
}

const guessToolName = (message: BaseMessage) => {
    const extra = message as BaseMessage & {
        additional_kwargs?: { function_call?: Record<string, unknown>; tool_calls?: Record<string, unknown>[]; name?: string };
        tool_calls?: Record<string, unknown>[];
        name?: string;
    };
    const functionCall = extra.additional_kwargs?.function_call as any;
    if (functionCall?.name) {
        return String(functionCall.name);
    }
    const toolCalls = (extra as any).tool_calls ?? extra.additional_kwargs?.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length) {
        const first = toolCalls[0] as { name?: unknown; function?: { name?: unknown } };
        if (typeof first?.name === "string") return first.name;
        if (typeof first?.function?.name === "string") return first.function.name;
        return undefined;
    }
    // ToolMessage: check direct name, then additional_kwargs.name
    if (message.type === "tool") {
        if (typeof extra.name === "string" && extra.name) return extra.name;
        if (typeof extra.additional_kwargs?.name === "string" && extra.additional_kwargs.name) return extra.additional_kwargs.name;
    }
    return undefined;
};

/**
 * Extract ALL tool calls from a multi-tool-call AIMessage.
 * Returns an array of { name, args, toolCallId } for each tool call.
 * Returns empty array if the message has no tool calls.
 */
const extractAllToolCalls = (message: BaseMessage): Array<{ name: string; args: string; toolCallId?: string }> => {
    const extra = message as BaseMessage & {
        additional_kwargs?: {
            function_call?: { name?: string; arguments?: unknown };
            tool_calls?: Array<{ id?: string; name?: string; args?: unknown; arguments?: unknown; function?: { name?: string; arguments?: unknown } }>;
        };
        tool_calls?: Array<{ id?: string; name?: string; args?: unknown; arguments?: unknown; function?: { name?: string; arguments?: unknown } }>;
    };
    const result: Array<{ name: string; args: string; toolCallId?: string }> = [];

    // Check LangChain tool_calls (parsed format)
    const toolCalls = extra.tool_calls ?? extra.additional_kwargs?.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        for (const tc of toolCalls) {
            const name = typeof tc.name === "string" ? tc.name : typeof tc.function?.name === "string" ? tc.function.name : undefined;
            if (!name) continue;
            const rawArgs = tc.args ?? tc.arguments ?? tc.function?.arguments;
            const args = typeof rawArgs === "string" ? rawArgs : rawArgs ? JSON.stringify(rawArgs) : "{}";
            result.push({ name, args, toolCallId: tc.id ? String(tc.id) : undefined });
        }
        return result;
    }

    // Legacy function_call format (only one)
    const functionCall = extra.additional_kwargs?.function_call;
    if (functionCall?.name) {
        const rawArgs = functionCall.arguments;
        const args = typeof rawArgs === "string" ? rawArgs : rawArgs ? JSON.stringify(rawArgs) : "{}";
        result.push({ name: functionCall.name, args });
    }

    return result;
};

const extractToolArgs = (message: BaseMessage): string | undefined => {
    const extra = message as BaseMessage & {
        additional_kwargs?: {
            function_call?: { arguments?: unknown };
            tool_calls?: Array<{ args?: unknown; arguments?: unknown; function?: { arguments?: unknown } }>;
        };
        tool_calls?: Array<{ args?: unknown; arguments?: unknown; function?: { arguments?: unknown } }>;
    };
    const functionCall = extra.additional_kwargs?.function_call;
    if (functionCall?.arguments !== undefined) {
        return typeof functionCall.arguments === "string"
            ? functionCall.arguments
            : JSON.stringify(functionCall.arguments);
    }
    const toolCalls = extra.tool_calls ?? extra.additional_kwargs?.tool_calls;
    const first = Array.isArray(toolCalls) ? toolCalls[0] : undefined;
    if (first?.args !== undefined) {
        return typeof first.args === "string" ? first.args : JSON.stringify(first.args);
    }
    if (first?.arguments !== undefined) {
        return typeof first.arguments === "string" ? first.arguments : JSON.stringify(first.arguments);
    }
    if (first?.function?.arguments !== undefined) {
        return typeof first.function.arguments === "string"
            ? first.function.arguments
            : JSON.stringify(first.function.arguments);
    }
    return undefined;
};

const extractToolCallId = (message: BaseMessage): string | undefined => {
    const direct = (message as BaseMessage & { tool_call_id?: string }).tool_call_id;
    if (direct) return String(direct);
    const extra = message as BaseMessage & {
        additional_kwargs?: { tool_call_id?: string; tool_calls?: Array<{ id?: string }> };
        tool_calls?: Array<{ id?: string }>;
    };
    if (extra.additional_kwargs?.tool_call_id) {
        return String(extra.additional_kwargs.tool_call_id);
    }
    const toolCalls = extra.tool_calls ?? extra.additional_kwargs?.tool_calls;
    const first = Array.isArray(toolCalls) ? toolCalls[0] : undefined;
    if (first?.id) return String(first.id);
    return undefined;
};

function createAgentEvent(
    message: BaseMessage,
    phaseId: string,
    phaseLabel: string,
    eventId: string
): AgentEvent {
    const extra = message as BaseMessage & {
        additional_kwargs?: { function_call?: Record<string, unknown>; tool_calls?: Record<string, unknown>[] };
        tool_calls?: Record<string, unknown>[];
    };
    const role = typeof (message as any).role === "string" ? (message as any).role : message.type ?? "assistant";
    const normalizedRole = role.toLowerCase();
    const messageType = typeof message.type === "string" ? message.type.toLowerCase() : "";
    const isToolResult = messageType === "tool";
    const hasToolCalls =
        Boolean(extra.additional_kwargs?.function_call) ||
        Boolean(extra.additional_kwargs?.tool_calls?.length) ||
        Boolean(extra.tool_calls?.length);
    const isSystemRole = normalizedRole === "system" || messageType === "system";
    const isUserRole =
        normalizedRole === "user" || normalizedRole === "human" || messageType === "user" || messageType === "human";
    // Tool results → kind "tool"; AI messages that issue tool calls → kind "assistant" (with toolName/toolArgs set)
    const kind: AgentEventKind = isToolResult ? "tool" : isSystemRole ? "system" : isUserRole ? "user" : "assistant";
    const toolArgs = extractToolArgs(message);
    const messageContent = describeMessageContent(message);
    let content = messageContent;
    let toolNote: string | undefined;
    if (hasToolCalls && !isToolResult) {
        // AI message issuing tool calls — store the raw content as a note, clear content
        toolNote = messageContent;
        content = "";
    } else if (!isToolResult) {
        toolNote = undefined;
    }

    // ── Extract thinking / reasoning ────────────────────────────────────
    let thoughts: string[] | undefined;

    if (kind === "assistant" && !hasToolCalls) {
        // 1. Structured thinking from the LLM API (Claude thinking blocks, GPT reasoning, <think> tags)
        const structured = extractThinkingFromMessage(message);
        if (structured.length > 0) {
            thoughts = structured;
            // Strip <think> blocks from the displayed content
            content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        }

        // 2. Heuristic fallback: extract reasoning from plain text
        if (!thoughts?.length && content) {
            const heuristic = extractThoughtsFromContent(content);
            if (heuristic.thoughts.length > 0) {
                thoughts = heuristic.thoughts;
                content = heuristic.content;
            }
        }
    }

    return {
        id: eventId,
        phaseId,
        phaseLabel,
        kind,
        role,
        name: guessToolName(message),
        toolCallId: extractToolCallId(message),
        content,
        toolNote,
        toolArgs,
        thoughts: thoughts?.length ? thoughts : undefined,
        timestamp: new Date().toISOString(),
    };
}

function createSessionTimeline(node: AgentGraphNode): TimelineEvent[] {
    return [
        {
            id: node.id,
            label: node.label,
            status: "running",
            summary: "Node execution (running)",
            details: "ReAct node execution stream",
            systemPrompt: node.react.systemPrompt,
            thoughtLog: [],
            startedAt: new Date().toISOString(),
        },
    ];
}

function extractFindingsFromState(state: Record<string, unknown> | undefined): Finding[] {
    if (!state) return [];
    // Direct findings array in state (e.g. from CI discovery node merging into state)
    const findings = (state as any).findings;
    if (Array.isArray(findings) && findings.length > 0) return findings as Finding[];
    // Scan node outputs for findings arrays
    const nodes = state.nodes as Record<string, unknown> | undefined;
    if (nodes && typeof nodes === "object") {
        for (const val of Object.values(nodes)) {
            if (val && typeof val === "object" && Array.isArray((val as any).findings) && (val as any).findings.length > 0) {
                return (val as any).findings as Finding[];
            }
        }
    }
    return [];
}

function createPlaceholderOutputs(opts: { mission: string; report: string; meta?: Record<string, unknown> }) {
    const state = opts.meta?.state as Record<string, unknown> | undefined;
    return {
        context: { mission: opts.mission ?? "", languages: [], frameworks: [], hotspots: [] },
        target_files: [],
        raw_claims: [],
        verified_findings: [],
        findings: extractFindingsFromState(state),
        tasks: [],
        report: opts.report ?? "",
        meta: opts.meta ?? {},
    } satisfies AgentWorkflowResult["outputs"];
}

/**
 * Create a comprehensive formatted report from workflow results
 */
function createFormattedReport(result: AgentWorkflowResult): {
    markdown?: string;
    json?: string;
    summary?: string;
} {
    const outputs = result.outputs || {};
    const timeline = result.timeline || [];
    const events = result.eventStream || [];

    // Calculate execution metrics
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    timeline.forEach(t => {
        if (t.tokenUsage) {
            totalInputTokens += t.tokenUsage.inputTokens || 0;
            totalOutputTokens += t.tokenUsage.outputTokens || 0;
        }
    });

    // Count findings by severity
    const findings = Array.isArray(outputs.findings) ? outputs.findings : [];
    const critical = findings.filter(f => f.severity === "critical").length;
    const high = findings.filter(f => f.severity === "high").length;
    const medium = findings.filter(f => f.severity === "medium").length;
    const low = findings.filter(f => f.severity === "low").length;

    // Determine overall status
    let status: "success" | "partial_success" | "failure" | "error" = "success";
    const errorCount = timeline.filter(t => t.status === "error").length;
    if (errorCount > 0) {
        status = errorCount >= timeline.length / 2 ? "failure" : "partial_success";
    }

    // Create executive summary
    let markdown = `# Automation Results Report\n\n`;
    markdown += `---\n\n`;

    // Executive Summary
    markdown += `## 📊 Executive Summary\n\n`;
    markdown += `**Status**: ${status === "success" ? "✅ Success" : status === "partial_success" ? "⚠️ Partial Success" : "❌ Failed"}\n\n`;

    // Execution Metrics
    const successCount = timeline.filter(t => t.status === "success").length;
    markdown += `### 🔢 Execution Metrics\n`;
    markdown += `- **Total Nodes**: ${timeline.length}\n`;
    markdown += `- **Successful**: ${successCount}\n`;
    markdown += `- **Failed**: ${errorCount}\n`;
    markdown += `- **Success Rate**: ${timeline.length > 0 ? Math.round((successCount / timeline.length) * 100) : 0}%\n\n`;

    // Token Usage
    const totalTokens = totalInputTokens + totalOutputTokens;
    markdown += `### 💬 Token Usage\n`;
    markdown += `- **Input Tokens**: ${totalInputTokens.toLocaleString()}\n`;
    markdown += `- **Output Tokens**: ${totalOutputTokens.toLocaleString()}\n`;
    markdown += `- **Total Tokens**: ${totalTokens.toLocaleString()}\n\n`;

    // Findings Summary
    const totalFindings = findings.length;
    markdown += `### 🔍 Findings Summary\n`;
    if (critical > 0) {
        markdown += `- ❌ **Critical Issues**: ${critical}\n`;
    }
    if (high > 0) {
        markdown += `- ⚠️ **High Priority**: ${high}\n`;
    }
    if (medium > 0) {
        markdown += `- 🔶 **Medium Priority**: ${medium}\n`;
    }
    if (low > 0) {
        markdown += `- 🔵 **Low Priority**: ${low}\n`;
    }
    markdown += `- **Total Findings**: ${totalFindings}\n\n`;

    // Detailed Findings Section
    if (findings.length > 0) {
        markdown += `## 📋 Detailed Findings\n\n`;

        if (critical > 0) {
            markdown += `### ❌ Critical Issues (${critical})\n\n`;
            findings.filter(f => f.severity === "critical").forEach((f, i) => {
                markdown += `**${i + 1}. ${f.title}**\n`;
                markdown += `${f.summary}\n`;
                if (f.evidence) {
                    markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
                }
                markdown += "\n";
            });
        }

        if (high > 0) {
            markdown += `### ⚠️ High Priority (${high})\n\n`;
            findings.filter(f => f.severity === "high").forEach((f, i) => {
                markdown += `**${i + 1}. ${f.title}**\n`;
                markdown += `${f.summary}\n`;
                if (f.evidence) {
                    markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
                }
                markdown += "\n";
            });
        }

        if (medium > 0) {
            markdown += `### 🔶 Medium Priority (${medium})\n\n`;
            findings.filter(f => f.severity === "medium").forEach((f, i) => {
                markdown += `**${i + 1}. ${f.title}**\n`;
                markdown += `${f.summary}\n`;
                if (f.evidence) {
                    markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
                }
                markdown += "\n";
            });
        }

        if (low > 0) {
            markdown += `### 🔵 Low Priority (${low})\n\n`;
            findings.filter(f => f.severity === "low").forEach((f, i) => {
                markdown += `**${i + 1}. ${f.title}**\n`;
                markdown += `${f.summary}\n`;
                if (f.evidence) {
                    markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
                }
                markdown += "\n";
            });
        }
    } else {
        markdown += `## 📋 Detailed Findings\n\nNo findings reported.\n\n`;
    }

    // Raw Output Section
    const rawReport = typeof outputs.report === "string" ? outputs.report : JSON.stringify(outputs.report || "", null, 2);
    markdown += `---\n\n`;
    markdown += `## 📄 Raw Output\n\n\`\`\`json\n${rawReport}\n\`\`\``;

    return {
        markdown,
        json: rawReport,
        summary: `Automation completed with ${status}. ${totalFindings} findings reported (${critical} critical, ${high} high, ${medium} medium, ${low} low). ${totalTokens.toLocaleString()} tokens used.`
    };
}

function selectToolsByName(toolNames: string[], extraTools: any[] = []) {
    const allow = new Set(toolNames ?? []);
    const merged = [...allMcpTools, ...extraTools];
    return merged.filter((tool: any) => allow.has(String(tool?.name ?? "")));
}

async function maybeExecuteJsonActionTool(opts: {
    schemaId: string;
    parsed: unknown;
    allowedToolNames: string[];
    phaseId: string;
    phaseLabel: string;
    makeEventId: () => string;
    pushEvent: (event: AgentEvent) => void;
    invokeToolByName: (name: string, args: Record<string, unknown>) => Promise<string>;
    ensureActive?: () => Promise<void>;
}) {
    // Only support this compatibility shim for generic JSON nodes.
    if (opts.schemaId !== "generic_json") return opts.parsed;
    if (!opts.parsed || typeof opts.parsed !== "object") return opts.parsed;
    const record = opts.parsed as Record<string, unknown>;
    const action = typeof record.action === "string" ? record.action : undefined;
    const args = record.arguments && typeof record.arguments === "object" ? (record.arguments as Record<string, unknown>) : undefined;
    if (!action || !args) return opts.parsed;

    // Only execute actions that are explicitly allowed on the node.
    if (!opts.allowedToolNames.includes(action)) return opts.parsed;

    // For safety, only allow write_file via this shim (LM Studio often "prints" tool calls).
    if (action !== "write_file") return opts.parsed;
    if (typeof args.filePath !== "string" || typeof args.content !== "string") return opts.parsed;

    if (opts.ensureActive) {
        await opts.ensureActive();
    }

    const toolResult = await opts.invokeToolByName(action, args);

    opts.pushEvent({
        id: opts.makeEventId(),
        phaseId: opts.phaseId,
        phaseLabel: opts.phaseLabel,
        kind: "tool",
        role: "tool",
        name: action,
        toolArgs: JSON.stringify(args),
        content: toolResult,
        timestamp: new Date().toISOString(),
    });

    return {
        action,
        arguments: args,
        toolResult,
    };
}

// Helper to ensure graph is ready
async function ensureContextGraphReady(workspaceId: string, rootPath: string) {
    const store = getContextGraphStore(workspaceId, rootPath);
    if (store.getAllNodes().length > 0) return store;

    console.log("[AgentGraph] Context graph is empty, attempting load...");
    await store.load();

    if (store.getAllNodes().length === 0) {
        console.log("[AgentGraph] Context graph still empty, triggering fresh workspace scan...");

        const scanner = new ContextScanner();
        await scanner.scanWorkspace(rootPath, store);
        await store.save();
        console.log(`[AgentGraph] Scan complete. Graph now has ${store.getAllNodes().length} nodes.`);
    }
    return store;
}

/**
 * Determine whether an event represents an AI message issuing tool calls
 * (as opposed to a tool result).  Handles both:
 *  - NEW data: kind="assistant" with name/toolArgs set
 *  - LEGACY data: kind="tool" but with toolArgs and empty content
 *    (backend previously assigned kind="tool" to both AI tool-call
 *     and tool-result messages — fixed now, but old data may exist).
 */
function isAiToolCallEvent(event: AgentEvent): boolean {
    // New format: assistant events with tool info
    if (event.kind === "assistant" && (event.name || event.toolName) && event.toolArgs) return true;
    // Legacy format: kind="tool" but has toolArgs and no meaningful content
    if (event.kind === "tool" && event.toolArgs && !event.content?.trim()) return true;
    return false;
}

/**
 * Convert AgentEvent[] conversation history to BaseMessage[] for multi-turn.
 * Mirrors the pattern used by ReActEngine for explore conversations.
 */
function convertConversationHistoryToMessages(events: AgentEvent[]): BaseMessage[] {
    const messages: BaseMessage[] = [];
    for (const event of events) {
        if (event.kind === "user") {
            messages.push(new HumanMessage(event.content));
        } else if (event.kind === "system") {
            messages.push(new SystemMessage(event.content));
        } else if (isAiToolCallEvent(event)) {
            // AI message that issues tool calls (new kind="assistant" or legacy kind="tool")
            const toolName = event.toolName || event.name;
            const msg = new AIMessage(event.content || "");
            if (toolName && event.toolArgs) {
                try {
                    (msg as any).tool_calls = [{
                        id: event.toolCallId || `call_${Date.now()}`,
                        name: toolName,
                        args: JSON.parse(event.toolArgs || "{}"),
                    }];
                } catch {
                    // ignore parse errors
                }
            }
            messages.push(msg);
        } else if (event.kind === "assistant") {
            // Pure text assistant message (no tool calls)
            messages.push(new AIMessage(event.content || ""));
        } else if (event.kind === "tool") {
            // Tool result
            messages.push(new ToolMessage(event.content || "", event.toolCallId || ""));
        }
    }
    return messages;
}

export class AgentGraphExecutor {
    async executeRun(runId: string): Promise<void> {
        await this.executeRunStreaming(runId);
    }

    /**
     * Continue an existing run with a follow-up message (multi-turn support).
     * For single-node graphs: re-executes the node with accumulated conversation history.
     * For multi-node graphs: re-executes the full graph with accumulated context.
     *
     * If the run was previously interrupted (status=PAUSED with checkpoint info),
     * and the message is an approval signal, the run resumes from the checkpoint.
     */
    async continueRun(
        runId: string,
        message: string,
        opts?: {
            onUpdate?: (update: AgentWorkflowUpdate) => Promise<void> | void;
            onTextDelta?: (delta: string) => void;
            llmSelectionOverride?: { provider: LlmProviderType; model?: string };
            shouldAbort?: () => Promise<AgentWorkflowAbortReason | null> | AgentWorkflowAbortReason | null;
        }
    ): Promise<AgentWorkflowResult> {
        console.log(`[AgentGraphExecutor] continueRun: runId=${runId}, message="${message.slice(0, 40)}"`);
        const run = await agentGraphRunService.getRun(runId);
        if (!run) throw new Error(`Run ${runId} not found`);
        console.log(`[AgentGraphExecutor] continueRun: run status="${run.status}", graphId=${run.graphId}`);

        // ── Check for checkpoint-based resume ────────────────────────────
        // If the run was interrupted (PAUSED with checkpoint metadata),
        // resume from the checkpoint instead of re-executing from scratch.
        const checkpoint = (run.state as any)?.checkpoint;
        const isInterruptedResume =
            run.status === "PAUSED" &&
            checkpoint?.status === "awaiting_approval" &&
            checkpoint?.threadId;

        if (isInterruptedResume) {
            console.log(`[AgentGraphExecutor] Resuming from checkpoint: threadId=${checkpoint.threadId}, nodeId=${checkpoint.nodeId}`);

            // ── Graph version guard ──────────────────────────────────────
            // If the graph definition changed since the checkpoint was taken,
            // resuming could produce undefined behaviour.  We warn and fall
            // through to the standard multi-turn continuation instead.
            let graphChanged = false;
            if (checkpoint.graphHash) {
                const currentGraph = await agentGraphService.getGraph(run.graphId.toString());
                if (currentGraph) {
                    const currentHash = computeGraphHash(currentGraph.nodes, currentGraph.edges);
                    if (currentHash !== checkpoint.graphHash) {
                        console.warn(
                            `[AgentGraphExecutor] Graph definition changed since checkpoint ` +
                            `(saved=${checkpoint.graphHash}, current=${currentHash}). ` +
                            `Cannot safely resume — falling back to fresh run.`
                        );
                        graphChanged = true;
                    }
                }
            }

            if (!graphChanged) {
                // Clear checkpoint metadata and mark as resuming
                const updatedState = {
                    ...run.state,
                    checkpoint: {
                        ...checkpoint,
                        status: "approved",
                        approvedAt: new Date().toISOString(),
                        approvalMessage: message,
                    },
                };

                // Append user approval to conversation history
                const history = updatedState.conversationHistory ?? [];
                history.push({
                    id: `event-approve-${Date.now()}`,
                    phaseId: "user",
                    phaseLabel: "User approval",
                    kind: "user" as const,
                    role: "user",
                    content: message,
                    timestamp: new Date().toISOString(),
                });
                updatedState.conversationHistory = history;

                // Reset only the interrupted node to PENDING
                const resetNodeStatuses: Record<string, any> = { ...run.nodeStatuses };
                if (checkpoint.nodeId) {
                    resetNodeStatuses[checkpoint.nodeId] = "PENDING";
                }

                await agentGraphRunService.updateRunStatus(runId, "PENDING", {
                    nodeStatuses: resetNodeStatuses,
                    state: updatedState,
                    endedAt: undefined,
                    error: undefined,
                } as any);

                await agentGraphRunService.incrementConversationTurns(runId);

                return this.executeRunStreaming(runId, {
                    ...opts,
                    enableCheckpoints: true,
                    resumeFromCheckpoint: true,
                });
            }
            // graphChanged=true → fall through to standard multi-turn continuation below
        }

        // ── Standard multi-turn continuation ─────────────────────────────

        // Append user message to conversation history
        const history = run.state.conversationHistory ?? [];
        history.push({
            id: `event-continue-${Date.now()}`,
            phaseId: "user",
            phaseLabel: "User input",
            kind: "user",
            role: "user",
            content: message,
            timestamp: new Date().toISOString(),
        });

        // Update state with new mission and conversation history
        const updatedState = {
            ...run.state,
            mission: message,
            userInput: message,
            conversationHistory: history,
        };

        // Reset node statuses for re-execution
        const resetNodeStatuses: Record<string, any> = {};
        for (const nodeId of run.nodeOrder) {
            resetNodeStatuses[nodeId] = "PENDING";
        }

        await agentGraphRunService.updateRunStatus(runId, "PENDING", {
            nodeStatuses: resetNodeStatuses,
            state: updatedState,
            endedAt: undefined,
            error: undefined,
        } as any);

        await agentGraphRunService.incrementConversationTurns(runId);

        return this.executeRunStreaming(runId, opts);
    }

    async executeRunStreaming(
        runId: string,
        opts?: {
            onUpdate?: (update: AgentWorkflowUpdate) => Promise<void> | void;
            /** Progressive text streaming callback — emits token-by-token text deltas */
            onTextDelta?: (delta: string) => void;
            llmSelectionOverride?: { provider: LlmProviderType; model?: string };
            shouldAbort?: () => Promise<AgentWorkflowAbortReason | null> | AgentWorkflowAbortReason | null;
            /**
             * If true, the agent will checkpoint state at every step and
             * interrupt before tool execution for human-in-the-loop approval.
             */
            enableCheckpoints?: boolean;
            /**
             * If true, resume from the last checkpoint instead of starting fresh.
             * Requires enableCheckpoints to also be true.
             */
            resumeFromCheckpoint?: boolean;
        }
    ): Promise<AgentWorkflowResult> {
        console.log(`[AgentGraphExecutor] executeRunStreaming: runId=${runId}`);
        const run = await agentGraphRunService.getRun(runId);
        if (!run) throw new Error(`Run ${runId} not found`);
        console.log(`[AgentGraphExecutor] executeRunStreaming: status="${run.status}", graphId=${run.graphId}, workspaceId=${run.workspaceId}`);

        const workspaceId = run.workspaceId?.toString() ?? null;
        const workspace = workspaceId
            ? await getWorkspaceByIdUnsafe(workspaceId)
            : (await listAllWorkspaces())[0];
        if (!workspace || !workspace._id) {
            throw new Error("Workspace not found for run execution.");
        }

        return await runWithWorkspaceContext(workspace, async () => {
        // Ensure context is ready before we start
        const contextGraphStore = await ensureContextGraphReady(
            workspace._id!.toString(),
            workspace.rootPath
        );

        // ── Checkpoint saver ─────────────────────────────────────────────
        // Lazily resolve the checkpoint saver.  If it fails (e.g. MongoDB is
        // unavailable) we continue without checkpoints.
        const enableCheckpoints = opts?.enableCheckpoints !== false; // on by default
        let checkpointer: import("@langchain/langgraph").BaseCheckpointSaver | undefined;
        if (enableCheckpoints) {
            try {
                checkpointer = await getCheckpointSaver();
            } catch (err) {
                console.warn("[AgentGraph] Checkpointer unavailable, continuing without:", (err as Error)?.message);
            }
        }

        const shouldAbort = opts?.shouldAbort;
        const abortController = new AbortController();
        let abortReason: AgentWorkflowAbortReason | null = null;
        let lastAbortCheck = 0;
        const ABORT_CHECK_INTERVAL_MS = 500;

        const checkAbortReason = async () => {
            if (abortReason) return abortReason;
            if (!shouldAbort) return null;
            const now = Date.now();
            if (now - lastAbortCheck < ABORT_CHECK_INTERVAL_MS) return null;
            lastAbortCheck = now;
            const reason = await shouldAbort();
            if (reason) {
                abortReason = reason;
                if (!abortController.signal.aborted) {
                    abortController.abort();
                }
            }
            return abortReason;
        };

        const ensureNotAborted = async () => {
            const reason = await checkAbortReason();
            if (reason) {
                throw new AgentWorkflowAbortError(reason);
            }
        };

        let auditContextConfig: { enabled: boolean; context: AuditContext | null } | null = null;
        try {
            auditContextConfig = await getAuditContextConfig(workspace._id!.toString());
        } catch (err) {
            console.warn("[AgentGraph] Failed to load audit context config:", err);
        }
        const contextInjectionEnabled = auditContextConfig?.enabled !== false;
        const auditContext = contextInjectionEnabled ? auditContextConfig?.context ?? null : null;

        let graph = await agentGraphService.getGraph(run.graphId.toString());
        if (!graph) {
            // Graph was deleted — fall back to first available graph
            const allGraphs = await agentGraphService.listGraphs();
            graph = allGraphs[0] ?? null;
            if (!graph) throw new Error(`No agent graphs available`);
            console.warn(`[AgentGraph] Graph ${run.graphId.toString()} not found, falling back to "${graph.name}"`);
        }

        const executionMode = resolveExecutionMode(graph);
        const timelineNodeIds = (run.nodeOrder?.length ? run.nodeOrder : getGraphNodeOrder(graph)).slice();
        if (!run.nodeOrder?.length) {
            await agentGraphRunService.setNodeOrder(runId, timelineNodeIds);
        }

        const state = cloneValue(run.state ?? { nodes: {} });
        if (!state.nodes) state.nodes = {};
        const workspaceObjectId =
            workspace._id && ObjectId.isValid(workspace._id.toString()) ? new ObjectId(workspace._id.toString()) : undefined;
        const rootDir = workspace.rootPath;

        const persistState = async () => {
            await agentGraphRunService.updateRunState(runId, cloneValue(state));
        };

        const normalizeTaskStatus = (value: string) => {
            if (value === "todo" || value === "done" || value === "in_progress") return value;
            return "todo";
        };

        const applyTodosUpdate = (tasks: Array<Record<string, unknown>>, currentTaskId?: string) => {
            const normalized = tasks.map((task, index) => {
                const id = typeof task.id === "string" && task.id ? task.id : `task-${index + 1}`;
                const title = typeof task.title === "string" ? task.title : `Task ${index + 1}`;
                const status = normalizeTaskStatus(typeof task.status === "string" ? task.status : "todo");
                return { id, title, status };
            });
            (state as any).taskQueue = normalized;
            const nextId =
                typeof currentTaskId === "string" && currentTaskId
                    ? currentTaskId
                    : normalized.find((t) => t.status !== "done")?.id ?? "";
            (state as any).currentTaskId = nextId;
        };

        const stableStringify = (value: unknown): string => {
            if (value === null || typeof value !== "object") return JSON.stringify(value);
            if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
            const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
            return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
        };

        const buildApprovalKey = (toolName: string, args: Record<string, unknown>) => {
            return `${toolName}:${stableStringify(args)}`;
        };

        const findApprovalByKey = (items: Array<Record<string, unknown>>, key: string) => {
            return items.find((item) => {
                const existingKey =
                    typeof item.key === "string"
                        ? String(item.key)
                        : buildApprovalKey(String(item.toolName ?? ""), (item.args as Record<string, unknown>) ?? {});
                return existingKey === key;
            });
        };

        const ensurePlannerOutput = (value: unknown, missionText: string) => {
            if (!value || typeof value !== "object") return value;
            const output = value as Record<string, any>;
            const rawTasks = Array.isArray(output.taskQueue) ? output.taskQueue : [];
            const normalized = rawTasks.map((task: any, index: number) => {
                const id = typeof task?.id === "string" && task.id ? task.id : `task-${index + 1}`;
                const title = typeof task?.title === "string" && task.title ? task.title : `Task ${index + 1}`;
                const status = normalizeTaskStatus(typeof task?.status === "string" ? task.status : "todo");
                return { id, title, status };
            });
            const minTasks = 3;
            if (normalized.length < minTasks) {
                const safeMission = missionText?.trim() || "the request";
                const fallbackTasks = [
                    { id: `task-${normalized.length + 1}`, title: `Locate relevant files and entry points for ${safeMission}.`, status: "todo" },
                    { id: `task-${normalized.length + 2}`, title: "Inspect implementation details and gather evidence.", status: "todo" },
                    { id: `task-${normalized.length + 3}`, title: "Summarize findings and propose improvements.", status: "todo" },
                ];
                const needed = Math.max(0, minTasks - normalized.length);
                normalized.push(...fallbackTasks.slice(0, needed));
            }
            output.taskQueue = normalized;
            if (!output.currentTaskId || typeof output.currentTaskId !== "string") {
                output.currentTaskId = normalized.find((t) => t.status !== "done")?.id ?? "";
            }
            const planIsEmpty =
                !output.plan ||
                (typeof output.plan === "object" &&
                    !Array.isArray(output.plan) &&
                    Object.keys(output.plan as Record<string, unknown>).length === 0);
            if (planIsEmpty) {
                output.plan = {
                    summary: "Auto-generated plan (planner output was empty).",
                    steps: normalized.map((task) => task.title),
                };
            }
            return output;
        };

        // ── write_todos deduplication & loop guard ────────────────────────
        let lastTodosHash: string | null = null;
        let consecutiveTodosDuplicates = 0;
        const MAX_CONSECUTIVE_TODOS_DUPLICATES = 2;

        const writeTodosTool = createTool(
            async (input: { tasks: Array<{ id?: string; title?: string; status?: string }>; currentTaskId?: string }) => {
                const tasks = Array.isArray(input.tasks) ? input.tasks : [];

                // Compute a stable hash of the incoming payload to detect duplicates
                const payloadHash = stableStringify({ tasks, currentTaskId: input.currentTaskId });
                if (payloadHash === lastTodosHash) {
                    consecutiveTodosDuplicates++;
                    if (consecutiveTodosDuplicates >= MAX_CONSECUTIVE_TODOS_DUPLICATES) {
                        return JSON.stringify(
                            {
                                updated: false,
                                warning: `Duplicate write_todos call detected ${consecutiveTodosDuplicates} times in a row. The task queue is already up to date — stop calling write_todos and proceed with actual work using other tools.`,
                                currentTaskId: (state as any).currentTaskId ?? "",
                                taskCount: Array.isArray((state as any).taskQueue) ? (state as any).taskQueue.length : 0,
                            },
                            null,
                            2
                        );
                    }
                } else {
                    consecutiveTodosDuplicates = 0;
                }
                lastTodosHash = payloadHash;

                applyTodosUpdate(tasks as Array<Record<string, unknown>>, input.currentTaskId);
                await persistState();
                return JSON.stringify(
                    {
                        updated: true,
                        currentTaskId: (state as any).currentTaskId ?? "",
                        taskCount: Array.isArray((state as any).taskQueue) ? (state as any).taskQueue.length : 0,
                    },
                    null,
                    2
                );
            },
            {
                name: "write_todos",
                description: "Update the task queue and current task pointer for this agent run. Do NOT call this repeatedly with the same payload — the tool will reject duplicates.",
                schema: z.object({
                    tasks: z
                        .array(
                            z.object({
                                id: z.string().optional(),
                                title: z.string().optional(),
                                status: z.enum(["todo", "in_progress", "done"]).optional(),
                            })
                        )
                        .default([]),
                    currentTaskId: z.string().optional(),
                }),
            }
        );

        const localTools = [writeTodosTool];

        const runSubGraph = async (message: string, graphId: string) => {
            const subGraph = await agentGraphService.getGraph(graphId);
            if (!subGraph) {
                throw new Error(`Subgraph ${graphId} not found`);
            }
            if (run.graphId?.toString?.() === graphId) {
                throw new Error("Subgraph cannot reference the current graph");
            }
            const nodeOrder = getGraphNodeOrder(subGraph);
            const subRunId = await agentGraphRunService.createRun(graphId, workspace._id?.toString());
            const initialNodeStatuses: Record<string, any> = {};
            for (const node of subGraph.nodes) {
                initialNodeStatuses[node.id] = "PENDING";
            }
            await agentGraphRunService.updateRunStatus(subRunId, "RUNNING", {
                nodeOrder,
                nodeStatuses: initialNodeStatuses,
                state: buildInitialState(subGraph, message),
            } as any);

            return await this.executeRunStreaming(subRunId, {
                llmSelectionOverride: opts?.llmSelectionOverride,
            });
        };
        if (auditContext) {
            const existingContext = (state as any).context;
            if (existingContext && typeof existingContext === "object" && !Array.isArray(existingContext)) {
                (state as any).context = { ...(existingContext as Record<string, unknown>), audit: auditContext };
            } else {
                (state as any).context = auditContext;
            }
        }
        const nodeRunCounts: Record<string, number> = {
            ...(state.execution?.runsByNode ?? {}),
        };
        let totalSteps = typeof state.execution?.step === "number" ? state.execution.step : 0;
        const executionHistory = Array.isArray(state.execution?.history) ? [...state.execution!.history!] : [];
        state.execution = {
            ...(state.execution ?? {}),
            mode: executionMode,
            step: totalSteps,
            runsByNode: nodeRunCounts,
            history: executionHistory,
        };

        await agentGraphRunService.updateRunStatus(runId, "RUNNING", {});

        // Initialize token usage tracking for this run
        tokenUsageService.startRunTracking(runId);

        const globalTimeline: TimelineEvent[] = timelineNodeIds.map((id) => {
            const node = graph.nodes.find((n) => n.id === id);
            return {
                id,
                label: node?.label ?? id,
                status: "pending",
                summary: "Pending",
                details: graph.description ?? "",
                systemPrompt: node?.react?.systemPrompt ?? "",
                thoughtLog: [],
            };
        });

        // Initialize conversation history in state if not present
        if (!state.conversationHistory) {
            state.conversationHistory = [];
        }

        const globalEventStream: AgentEvent[] = [];
        // Offset counter by existing conversation history length so IDs are
        // unique across multi-turn continuations (each turn starts from where
        // the previous one left off instead of event-0 again).
        let globalEventCounter = state.conversationHistory?.length ?? 0;
        const nextGlobalEventId = () => `event-${globalEventCounter++}`;

        // For multi-turn continuations, continueRun already pushed the user
        // event to conversationHistory (with id "event-continue-{ts}").
        // Reuse that event for globalEventStream so IDs stay consistent
        // between the stream and the persisted conversation history.
        const missionContent = typeof state.mission === "string" ? state.mission : "";
        const lastHistoryEvent = state.conversationHistory.length > 0
            ? state.conversationHistory[state.conversationHistory.length - 1]
            : null;
        const existingUserEvent =
            lastHistoryEvent &&
            lastHistoryEvent.kind === "user" &&
            lastHistoryEvent.content === missionContent
                ? lastHistoryEvent
                : null;

        const initialUserEvent: AgentEvent = existingUserEvent ?? {
            id: nextGlobalEventId(),
            phaseId: "user",
            phaseLabel: "User input",
            kind: "user",
            role: "user",
            content: missionContent,
            timestamp: new Date().toISOString(),
        };
        globalEventStream.push(initialUserEvent);

        // Add the initial user event to conversation history (only for the first turn
        // when no existing event was found)
        if (!existingUserEvent) {
            state.conversationHistory.push(initialUserEvent);
        }

        const emitUpdate = async () => {
            if (!opts?.onUpdate) return;
            // Include running token usage in meta
            const runningTokenUsage = tokenUsageService.getRunAccumulatedUsage(runId);
            const outputs = createPlaceholderOutputs({
                mission: typeof state.mission === "string" ? state.mission : "",
                report: JSON.stringify(state.nodes ?? {}, null, 2),
                meta: {
                    runId,
                    graphId: run.graphId.toString(),
                    state: cloneValue(state),
                    tokenUsage: runningTokenUsage,
                },
            });
            await opts.onUpdate({
                timeline: cloneValue(globalTimeline),
                eventStream: cloneValue(globalEventStream),
                outputs,
            });
        };

        await emitUpdate();

        const pendingNodeIds =
            executionMode === "dag" ? timelineNodeIds.slice() : getEntryNodeIds(graph);
        const maxIterations = graph.execution?.maxIterations ?? 200;
        const maxNodeRuns = graph.execution?.maxNodeRuns ?? 20;

        const selectNextNodes = (currentId: string) => {
            if (executionMode !== "state_machine") return [];
            const matched: string[] = [];
            const seen = new Set<string>();
            const outgoing = graph.edges.filter((e) => e.source === currentId);
            for (const edge of outgoing) {
                if (evaluateCondition(edge.condition, state)) {
                    if (!seen.has(edge.target)) {
                        matched.push(edge.target);
                        seen.add(edge.target);
                    }
                }
            }
            return matched;
        };

        while (pendingNodeIds.length) {
            await ensureNotAborted();
            const nodeId = pendingNodeIds.shift()!;
            const node = graph.nodes.find((n) => n.id === nodeId);
            if (!node) {
                await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                    endedAt: new Date(),
                    error: `Missing node ${nodeId} in graph definition`,
                } as any);
                const failureResult: AgentWorkflowResult = {
                    sessionId: runId,
                    timeline: globalTimeline,
                    conclusion: "Run failed (missing node).",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: Missing node ${nodeId} in graph definition`,
                        meta: { runId, graphId: run.graphId.toString() },
                    }),
                    eventStream: globalEventStream,
                };
                await emitUpdate();
                return failureResult;
            }

            totalSteps += 1;
            nodeRunCounts[nodeId] = (nodeRunCounts[nodeId] ?? 0) + 1;
            state.execution = {
                ...(state.execution ?? {}),
                mode: executionMode,
                step: totalSteps,
                runsByNode: nodeRunCounts,
                history: [...executionHistory, nodeId],
                lastNodeId: nodeId,
            };
            executionHistory.push(nodeId);
            if (totalSteps > maxIterations) {
                const message = `Max iterations exceeded (${maxIterations}).`;
                await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                    endedAt: new Date(),
                    error: message,
                } as any);
                const failureResult: AgentWorkflowResult = {
                    sessionId: runId,
                    timeline: globalTimeline,
                    conclusion: "Run failed (max iterations).",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: ${message}`,
                        meta: { runId, graphId: run.graphId.toString(), state: cloneValue(state) },
                    }),
                    eventStream: globalEventStream,
                };
                await emitUpdate();
                return failureResult;
            }
            if (nodeRunCounts[nodeId] > maxNodeRuns) {
                const message = `Max node executions exceeded for ${nodeId} (${maxNodeRuns}).`;
                await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                    endedAt: new Date(),
                    error: message,
                } as any);
                const failureResult: AgentWorkflowResult = {
                    sessionId: runId,
                    timeline: globalTimeline,
                    conclusion: "Run failed (max node runs).",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: ${message}`,
                        meta: { runId, graphId: run.graphId.toString(), state: cloneValue(state) },
                    }),
                    eventStream: globalEventStream,
                };
                await emitUpdate();
                return failureResult;
            }

            await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "RUNNING");
            const timelineEntry = globalTimeline.find((t) => t.id === nodeId);
            if (timelineEntry) {
                timelineEntry.status = "running";
                timelineEntry.summary = "Running";
                timelineEntry.startedAt = new Date().toISOString();
            }
            await emitUpdate();

            const timeline = createSessionTimeline(node);
            const eventStream: AgentEvent[] = [];
            // Use globalEventCounter to ensure unique IDs across all events in globalEventStream
            const nextEventId = () => nextGlobalEventId();

            const userPrompt = renderUserPrompt(node.react.userPromptTemplate, state);
            const systemEvent: AgentEvent = {
                id: nextEventId(),
                phaseId: node.id,
                phaseLabel: node.label,
                kind: "system",
                role: "system",
                content: node.react.systemPrompt,
                timestamp: new Date().toISOString(),
            };
            const userEvent: AgentEvent = {
                id: nextEventId(),
                phaseId: node.id,
                phaseLabel: node.label,
                kind: "user",
                role: "user",
                content: userPrompt,
                timestamp: new Date().toISOString(),
            };
            eventStream.push(systemEvent, userEvent);

            const flushUpdate = async () => {
                await emitUpdate();
            };

            await flushUpdate();

            try {
                const nodeKind = node.kind ?? "react";

                // ---------------------------------------------------------
                // 2.5. Skills Injection (NEW)
                // ---------------------------------------------------------
                const skillIds = node.react.skillIds ?? [];
                let skillPromptPrefix = "";
                let skillTools: string[] = [];
                if (skillIds.length > 0) {
                    try {
                        const resolvedSkills = await skillRegistry.getSkills(skillIds);
                        skillPromptPrefix = resolvedSkills
                            .map((s) => s.resolvedSystemPrompt)
                            .filter(Boolean)
                            .join("\n\n---\n\n");
                        skillTools = [...new Set(resolvedSkills.flatMap((s) => s.resolvedTools))];
                    } catch (err) {
                        console.warn(`[AgentGraph] Failed to load skills ${skillIds.join(", ")}:`, err);
                    }
                }
                // Merge skill tools with node-defined tools
                const mergedToolNames = [...new Set([...(node.react.toolNames ?? []), ...skillTools, "write_todos"])];
                const selectedTools = selectToolsByName(mergedToolNames, localTools);
                const toolInvokerMap = new Map<string, (input: Record<string, unknown>) => Promise<string>>();

                // ── Tool call deduplication ──────────────────────────────────
                // Track recent read-only tool calls to avoid identical re-invocations.
                // Write tools (write_file, execute_bash, str_replace_editor) are NOT
                // deduplicated since they have side effects.
                const DEDUP_CACHE_MAX = 50;
                const READ_ONLY_DEDUP_TOOLS = new Set([
                    "list_files", "read_file", "read_file_range", "search_code",
                    "repo_metrics", "dependency_info", "describe_structure",
                    "git_log", "git_diff", "git_grep", "git_blame",
                    "semantic_code_search", "structural_search", "symbols_list",
                    "find_symbol", "go_to_definition", "references", "find_references",
                    "todo_search", "bootstrap_context", "web_search", "fetch_url",
                    "output_format", "write_todos",
                ]);
                const toolCallCache = new Map<string, string>();
                let toolCallCount = 0;

                const invokeBaseTool = async (baseTool: any, input: unknown) => {
                    if (typeof baseTool?.invoke === "function") {
                        return await baseTool.invoke(input);
                    }
                    if (typeof baseTool?.call === "function") {
                        return await baseTool.call(input);
                    }
                    if (typeof baseTool?.func === "function") {
                        return await baseTool.func(input);
                    }
                    throw new Error(`Tool ${String(baseTool?.name ?? "unknown")} is not callable`);
                };

                const handleMemoryTool = async (toolName: string, input: Record<string, unknown>) => {
                    if (!workspaceObjectId) return null;
                    const memoryPath = extractMemoryPath(toolName, input);
                    if (!memoryPath) return null;
                    try {
                        if (toolName === "list_files") {
                            const items = await agentMemoryService.list(memoryPath, workspaceObjectId);
                            if (!items.length) return `No memory entries found under ${memoryPath}`;
                            return items
                                .map((item) => `${item.path} (size: ${item.size}, updated: ${item.updatedAt.toISOString()})`)
                                .join("\n");
                        }
                        if (toolName === "read_file") {
                            return await agentMemoryService.read(memoryPath, workspaceObjectId);
                        }
                        if (toolName === "read_file_range") {
                            const content = await agentMemoryService.read(memoryPath, workspaceObjectId);
                            const start = Math.max(1, Number(input.startLine ?? 1));
                            const end = Math.max(start, Number(input.endLine ?? start));
                            const lines = content.split("\n");
                            const slice = lines.slice(start - 1, end);
                            return slice.map((line, idx) => `${start + idx}: ${line}`).join("\n");
                        }
                        if (toolName === "write_file") {
                            const content = typeof input.content === "string" ? input.content : "";
                            await agentMemoryService.write(memoryPath, content, workspaceObjectId);
                            return `Memory updated at ${memoryPath} (${content.length} chars).`;
                        }
                        return null;
                    } catch (err) {
                        return `Memory error: ${(err as Error)?.message ?? String(err)}`;
                    }
                };

                const wrapTool = (baseTool: any) => {
                    const name = String(baseTool?.name ?? "unknown");
                    const description = baseTool?.description ?? "";
                    const schema = baseTool?.schema ?? z.any();
                    const returnDirect = (baseTool as any)?.returnDirect;
                    const wrapped = createTool(
                        async (input: Record<string, unknown>) => {
                            await ensureNotAborted();
                            toolCallCount++;

                            // ── Dedup: return cached result for identical read-only calls ──
                            if (READ_ONLY_DEDUP_TOOLS.has(name) && name !== "write_todos") {
                                const cacheKey = `${name}:${stableStringify(input)}`;
                                const cached = toolCallCache.get(cacheKey);
                                if (cached !== undefined) {
                                    return `[Cached — identical call was already made this turn]\n${cached}`;
                                }
                            }

                            const memoryResult = await handleMemoryTool(name, input);
                            if (memoryResult !== null) {
                                const evicted = await maybeEvictToolResult({
                                    rootDir,
                                    runId,
                                    nodeId: node.id,
                                    toolName: name,
                                    rawResult: memoryResult,
                                });
                                // Cache memory results too
                                if (READ_ONLY_DEDUP_TOOLS.has(name) && name !== "write_todos" && typeof evicted === "string") {
                                    const cacheKey = `${name}:${stableStringify(input)}`;
                                    if (toolCallCache.size >= DEDUP_CACHE_MAX) {
                                        const firstKey = toolCallCache.keys().next().value;
                                        if (firstKey !== undefined) toolCallCache.delete(firstKey);
                                    }
                                    toolCallCache.set(cacheKey, evicted.slice(0, TOOL_RESULT_PREVIEW_CHARS));
                                }
                                return evicted;
                            }

                            if (name === "write_file" || name === "execute_bash" || name === "str_replace_editor") {
                                const descriptionText =
                                    name === "write_file"
                                        ? `Write file ${String(input?.filePath ?? "")}`
                                        : name === "str_replace_editor"
                                        ? `Edit file ${String((input as any)?.filePath ?? (input as any)?.path ?? "")}`
                                        : `Execute command ${String(input?.command ?? "")}`;
                                const approvals = (state as any).approvals ?? {};
                                const pending = Array.isArray(approvals.pending) ? approvals.pending.slice() : [];
                                const granted = Array.isArray(approvals.granted) ? approvals.granted.slice() : [];
                                const approvalKey = buildApprovalKey(name, input);

                                const existingPending = findApprovalByKey(pending, approvalKey);
                                if (existingPending) {
                                    return `Approval already pending (ID: ${existingPending.id}).`;
                                }
                                const existingGranted = findApprovalByKey(granted, approvalKey);
                                if (existingGranted) {
                                    const result = typeof existingGranted.result === "string" ? existingGranted.result : "";
                                    if (result) return result;
                                    if (typeof existingGranted.evictedPath === "string" && existingGranted.evictedPath) {
                                        return `Result already available at ${existingGranted.evictedPath}`;
                                    }
                                    return `Approval already granted (ID: ${existingGranted.id}).`;
                                }

                                const edit = safeEditGate.proposeEdit(
                                    runId,
                                    name,
                                    input,
                                    descriptionText,
                                    workspaceObjectId?.toString()
                                );
                                pending.push({
                                    id: edit.id,
                                    toolName: edit.toolName,
                                    args: edit.args,
                                    status: edit.status,
                                    createdAt: edit.createdAt,
                                    description: edit.description,
                                    key: approvalKey,
                                });
                                (state as any).approvals = { ...approvals, pending };
                                await persistState();
                                return `Approval required. Proposed ${name} with ID ${edit.id}.`;
                            }

                            const result = await invokeBaseTool(baseTool, input);
                            const finalResult = await maybeEvictToolResult({
                                rootDir,
                                runId,
                                nodeId: node.id,
                                toolName: name,
                                rawResult: result,
                            });

                            // Cache read-only results for dedup
                            if (READ_ONLY_DEDUP_TOOLS.has(name) && name !== "write_todos" && typeof finalResult === "string") {
                                const cacheKey = `${name}:${stableStringify(input)}`;
                                if (toolCallCache.size >= DEDUP_CACHE_MAX) {
                                    // Evict oldest entry
                                    const firstKey = toolCallCache.keys().next().value;
                                    if (firstKey !== undefined) toolCallCache.delete(firstKey);
                                }
                                toolCallCache.set(cacheKey, finalResult.slice(0, TOOL_RESULT_PREVIEW_CHARS));
                            }

                            return finalResult;
                        },
                        { name, description, schema, returnDirect }
                    );
                    toolInvokerMap.set(name, async (input: Record<string, unknown>) => {
                        return await wrapped.invoke(input);
                    });
                    return wrapped;
                };

                const tools = selectedTools.map(wrapTool);

                const builtMessageEvents: AgentEvent[] = [];
                const pushEvent = (event: AgentEvent) => {
                    builtMessageEvents.push(event);
                    eventStream.push(event);
                    globalEventStream.push(event);
                    state.conversationHistory!.push(event);
                };
                const handleStreamingMessage = async (message: BaseMessage) => {
                    await ensureNotAborted();

                    // For AI messages with multiple tool calls, create one event per
                    // tool call so that each call pairs correctly with its result.
                    const allCalls = extractAllToolCalls(message);
                    if (allCalls.length > 1) {
                        const messageContent = describeMessageContent(message);
                        for (const tc of allCalls) {
                            const tcEvent: AgentEvent = {
                                id: nextEventId(),
                                phaseId: node.id,
                                phaseLabel: node.label,
                                kind: "assistant",
                                role: "assistant",
                                name: tc.name,
                                toolCallId: tc.toolCallId,
                                content: "",
                                toolNote: messageContent || undefined,
                                toolArgs: tc.args,
                                timestamp: new Date().toISOString(),
                            };
                            pushEvent(tcEvent);
                        }
                        await flushUpdate();
                        return;
                    }

                    // Single or zero tool calls: use standard createAgentEvent
                    const event = createAgentEvent(message, node.id, node.label, nextEventId());
                    pushEvent(event);
                    await flushUpdate();
                };

                // ---------------------------------------------------------
                // 3. Smart Context Injection (New Architecture)
                // ---------------------------------------------------------
                let contextBlock = "";
                if (contextInjectionEnabled) {
                    // We rank context based on the rendered user prompt + editor state
                    const editorState = getEditorStateManager(workspace._id!.toString()).getCurrentState();
                    const ranker = new ContextRanker(contextGraphStore);
                    const rankedContext = await ranker.rank({
                        userPrompt: userPrompt, // Using existing `userPrompt`
                        editorState,
                        limit: 15, // Retrieve top 15 most relevant
                        tokenBudget: 30000 // Reserve budget
                    });

                    // Format the context for the System Prompt
                    contextBlock = `\n\n## ACTIVE CONTEXT (Auto-Detected)\n`;
                    if (editorState.activeFile) {
                        contextBlock += `- Current File: ${editorState.activeFile}\n`;
                    }

                    if (rankedContext.length > 0) {
                        contextBlock += `\nThe following files are likely relevant to your task:\n`;
                        for (const item of rankedContext) {
                            const rel = (item.score * 100).toFixed(0);
                            const reasonText = typeof item.reason === "string" ? item.reason : "";
                            contextBlock += `- ${item.node.id} (Relevance: ${rel}% - ${reasonText})\n`;
                            // Future: Inject snippets here if budget allows
                        }
                    } else {
                        contextBlock += `No specific relevant files detected in context graph.\n`;
                    }
                }

                // Compose final system prompt: skills prefix + base prompt + context
                const renderedSystemPrompt = renderUserPrompt(node.react.systemPrompt, state);
                const baseSystemPrompt = skillPromptPrefix
                    ? `${skillPromptPrefix}\n\n---\n\n${renderedSystemPrompt}`
                    : renderedSystemPrompt;
                const auditContextPrompt = auditContext ? formatAuditContextPrompt(auditContext) : null;
                const taskQueue = Array.isArray((state as any).taskQueue) ? (state as any).taskQueue : [];
                const currentTaskId = typeof (state as any).currentTaskId === "string" ? (state as any).currentTaskId : "";
                const taskContextBlock = [
                    "\n\n## PLAN & TASK QUEUE",
                    `Current task id: ${currentTaskId || "(none)"}`,
                    `Task queue: ${JSON.stringify(taskQueue, null, 2)}`,
                    "Use write_todos to create or update the task queue when the mission requires multiple steps.",
                    "IMPORTANT: Do NOT call write_todos repeatedly with the same payload. Call it once, then proceed with actual work.",
                ].join("\n");

                // ── Workspace awareness block ────────────────────────────────
                // Prevents the agent from asking "how do I access the repo?"
                const workspaceContextBlock = [
                    "\n\n## WORKSPACE ENVIRONMENT",
                    `You are running inside the repository at: ${rootDir}`,
                    `Workspace ID: ${workspace._id?.toString() ?? "default"}`,
                    "You already have full filesystem access via tools (list_files, read_file, search_code, etc.).",
                    "Do NOT ask the user for repository access — you already have it.",
                    "Do NOT re-plan if you have already created a plan — proceed with execution.",
                    "",
                    "## ANTI-LOOPING RULES",
                    "- Never call the same tool with identical arguments more than once per turn. Reuse prior results.",
                    "- Never call write_todos more than twice without making progress on actual tasks between calls.",
                    "- If a tool returns a cached/duplicate warning, stop calling it and use the existing result.",
                    "- Focus on PRODUCING OUTPUT, not endlessly planning. After gathering information, synthesize and report.",
                ].join("\n");

                const enhancedSystemPrompt = `${baseSystemPrompt}${workspaceContextBlock}${contextBlock}${taskContextBlock}${auditContextPrompt ? `\n\n${auditContextPrompt}` : ""}`;

                // Update timeline with the ACTUAL prompt used (including context)
                if (timeline[0]) {
                    timeline[0].systemPrompt = enhancedSystemPrompt;
                }

                // ---------------------------------------------------------
                // 4. Execution
                // ---------------------------------------------------------
                // this.ensureActiveEvent("assistant"); // Commented out as `this` context is `AgentGraphExecutor` not a React component.

                // We'll capture the *new* messages from this turn
                let validated: unknown;
                if (nodeKind === "router") {
                    const routerNote: AgentEvent = {
                        id: nextEventId(),
                        phaseId: node.id,
                        phaseLabel: node.label,
                        kind: "assistant",
                        role: "assistant",
                        content: "Router node executed. Evaluating outgoing conditions.",
                        timestamp: new Date().toISOString(),
                    };
                    eventStream.push(routerNote);
                    globalEventStream.push(routerNote);
                    await flushUpdate();
                    const schemaId = node.output.schemaId as keyof typeof nodeOutputSchemaRegistry;
                    const schema = nodeOutputSchemaRegistry[schemaId];
                    if (!schema) {
                        throw new Error(`Unknown schemaId: ${node.output.schemaId}`);
                    }
                    validated = schema.parse({
                        route: "conditional_edges",
                        timestamp: new Date().toISOString(),
                    });
                } else if (nodeKind === "delegate") {
                    const delegateConfig = node.delegate ?? { mode: "react" };
                    const delegateInput = userPrompt;
                    let rawResult = "";

                    if (delegateConfig.mode === "graph") {
                        if (!delegateConfig.graphId) {
                            throw new Error(`Delegate node ${node.id} requires delegate.graphId`);
                        }
                        const delegateRun = await runSubGraph(delegateInput, delegateConfig.graphId);
                        rawResult = typeof delegateRun.outputs?.report === "string"
                            ? delegateRun.outputs.report
                            : JSON.stringify(delegateRun.outputs ?? {}, null, 2);
                    } else {
                        const delegateResult = await streamReactAgentMessages({
                            name: `Delegate:${node.id}`,
                            systemPrompt: enhancedSystemPrompt,
                            userPrompt: delegateInput,
                            tools,
                            llmSelection: opts?.llmSelectionOverride ?? node.react.llmSelection,
                            abortSignal: abortController.signal,
                            getAbortReason: () => abortReason,
                            shouldAbort: checkAbortReason,
                            onTokenUsage: async (usage, model) => {
                                await tokenUsageService.logUsage({
                                    timestamp: new Date(),
                                    provider: (opts?.llmSelectionOverride?.provider ?? node.react.llmSelection?.provider ?? "unknown") as any,
                                    model,
                                    usage,
                                    ...(workspaceObjectId ? { workspaceId: workspaceObjectId } : {}),
                                    runId: new ObjectId(runId),
                                    nodeId: node.id,
                                    callType: "delegate_agent",
                                });
                            },
                        });
                        const delegateMessages = delegateResult.messages ?? [];
                        const delegateFinal =
                            delegateMessages
                                .slice()
                                .reverse()
                                .find((message) => {
                                    const role = typeof (message as any).role === "string" ? String((message as any).role).toLowerCase() : "";
                                    const type = typeof message.type === "string" ? message.type.toLowerCase() : "";
                                    return role === "assistant" || type === "ai" || type === "assistant";
                                }) ?? delegateMessages.at(-1);
                        rawResult = delegateFinal ? describeMessageContent(delegateFinal) : "";
                    }

                    if (rawResult.length > TOOL_RESULT_EVICT_CHARS) {
                        const relativePath = await writeEvictedToolResult({
                            rootDir,
                            runId,
                            nodeId: node.id,
                            toolName: "delegate_result",
                            content: rawResult,
                        });
                        rawResult = `Delegate result evicted to ${relativePath}. Use read_file to inspect.`;
                    }

                    const schemaId = node.output.schemaId as keyof typeof nodeOutputSchemaRegistry;
                    const schema = nodeOutputSchemaRegistry[schemaId];
                    if (!schema) {
                        throw new Error(`Unknown schemaId: ${node.output.schemaId}`);
                    }

                    let parsed: unknown;
                    if (delegateConfig.summaryPrompt && delegateConfig.summaryPrompt.trim().length > 0) {
                        const summaryPrompt = renderUserPrompt(delegateConfig.summaryPrompt, state);
                        const summaryResult = await streamReactAgentMessages({
                            name: `DelegateSummary:${node.id}`,
                            systemPrompt: summaryPrompt,
                            userPrompt: rawResult,
                            tools: [],
                            llmSelection: delegateConfig.summaryLlmSelection ?? node.react.llmSelection,
                            abortSignal: abortController.signal,
                            getAbortReason: () => abortReason,
                            shouldAbort: checkAbortReason,
                            onTokenUsage: async (usage, model) => {
                                await tokenUsageService.logUsage({
                                    timestamp: new Date(),
                                    provider: (delegateConfig.summaryLlmSelection?.provider ?? node.react.llmSelection?.provider ?? "unknown") as any,
                                    model,
                                    usage,
                                    ...(workspaceObjectId ? { workspaceId: workspaceObjectId } : {}),
                                    runId: new ObjectId(runId),
                                    nodeId: node.id,
                                    callType: "delegate_summary",
                                });
                            },
                        });
                        const summaryMessages = summaryResult.messages ?? [];
                        const summaryFinal =
                            summaryMessages
                                .slice()
                                .reverse()
                                .find((message) => {
                                    const role = typeof (message as any).role === "string" ? String((message as any).role).toLowerCase() : "";
                                    const type = typeof message.type === "string" ? message.type.toLowerCase() : "";
                                    return role === "assistant" || type === "ai" || type === "assistant";
                                }) ?? summaryMessages.at(-1);
                        const summaryContent = summaryFinal ? describeMessageContent(summaryFinal) : "";
                        const summaryEvent: AgentEvent = {
                            id: nextEventId(),
                            phaseId: node.id,
                            phaseLabel: node.label,
                            kind: "assistant",
                            role: "assistant",
                            content: summaryContent,
                            timestamp: new Date().toISOString(),
                        };
                        eventStream.push(summaryEvent);
                        globalEventStream.push(summaryEvent);
                        await flushUpdate();
                        parsed = parseJsonOutput(summaryContent);
                    } else {
                        parsed = {
                            summary: rawResult.slice(0, 4000),
                            raw: rawResult,
                        };
                        const summaryEvent: AgentEvent = {
                            id: nextEventId(),
                            phaseId: node.id,
                            phaseLabel: node.label,
                            kind: "assistant",
                            role: "assistant",
                            content: JSON.stringify(parsed, null, 2),
                            timestamp: new Date().toISOString(),
                        };
                        eventStream.push(summaryEvent);
                        globalEventStream.push(summaryEvent);
                        await flushUpdate();
                    }

                    validated = schema.parse(parsed);
                } else {
                    // Build extraMessages from prior conversation history for multi-turn
                    const priorHistory = state.conversationHistory ?? [];
                    const extraMessages = priorHistory.length > 0
                        ? convertConversationHistoryToMessages(priorHistory).filter(m => m.getType() !== "system")
                        : undefined;

                    // ── Checkpoint / Resume ──────────────────────────────
                    // Each (run, node) gets a unique LangGraph thread_id so
                    // checkpoints are scoped correctly.
                    const threadId = checkpointer ? `${runId}:${node.id}` : undefined;
                    const shouldResume = !!(
                        opts?.resumeFromCheckpoint &&
                        checkpointer &&
                        threadId &&
                        (await hasCheckpoint(threadId))
                    );

                    // Read the per-node interruptBeforeTools config.
                    // Only meaningful when checkpointing is active.
                    const interruptBeforeTools = !!(
                        checkpointer &&
                        node.react.interruptBeforeTools
                    );

                    const result = await streamReactAgentMessages({
                        name: `GraphNode:${node.id}`,
                        systemPrompt: enhancedSystemPrompt,
                        userPrompt: userPrompt,
                        tools,
                        llmSelection: opts?.llmSelectionOverride ?? node.react.llmSelection,
                        extraMessages: shouldResume ? undefined : extraMessages,
                        onMessage: handleStreamingMessage,
                        // Forward text deltas for progressive streaming
                        onTextDelta: opts?.onTextDelta,
                        abortSignal: abortController.signal,
                        getAbortReason: () => abortReason,
                        shouldAbort: checkAbortReason,
                        // Checkpoint / persistence
                        checkpointer,
                        threadId,
                        interruptBeforeTools,
                        resumeFromCheckpoint: shouldResume,
                        onTokenUsage: async (usage, model) => {
                            // Log individual usage to MongoDB and accumulate in-memory
                            await tokenUsageService.logUsage({
                                timestamp: new Date(),
                                provider: (opts?.llmSelectionOverride?.provider ?? node.react.llmSelection?.provider ?? "unknown") as any,
                                model,
                                usage,
                                ...(workspaceObjectId ? { workspaceId: workspaceObjectId } : {}),
                                runId: new ObjectId(runId),
                                nodeId: node.id,
                                callType: "react_agent",
                            });
                        },
                    });

                    // ── Handle interrupt (human-in-the-loop) ─────────────
                    if (result.interrupted) {
                        console.log(`[AgentGraph] Node ${node.id} interrupted (checkpoint saved). Awaiting human approval.`);
                        await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "RUNNING");
                        await agentGraphRunService.updateRunStatus(runId, "PAUSED", {
                            error: `Interrupted at node ${node.id}: awaiting approval.`,
                        } as any);
                        // Update state with checkpoint info (including graph hash for version guard)
                        (state as any).checkpoint = {
                            threadId,
                            nodeId: node.id,
                            interruptedAt: new Date().toISOString(),
                            status: "awaiting_approval",
                            graphHash: computeGraphHash(graph.nodes, graph.edges),
                        };
                        await agentGraphRunService.updateRunState(runId, cloneValue(state));

                        if (timelineEntry) {
                            timelineEntry.status = "running";
                            timelineEntry.summary = "Paused — awaiting approval";
                        }
                        await emitUpdate();

                        // Return partial result; the caller will see status=PAUSED
                        const { summary: partialTokenUsage } = tokenUsageService.finalizeRunTracking(runId);
                        await agentGraphRunService.updateRunTokenUsage(runId, partialTokenUsage);
                        return {
                            sessionId: runId,
                            timeline: globalTimeline,
                            conclusion: "Run paused (human-in-the-loop interrupt).",
                            outputs: createPlaceholderOutputs({
                                mission: typeof state.mission === "string" ? state.mission : "",
                                report: "Awaiting human approval to continue.",
                                meta: { runId, graphId: run.graphId.toString(), state: cloneValue(state), interrupted: true },
                            }),
                            eventStream: globalEventStream,
                        };
                    }

                    const finalAgentEvent =
                        builtMessageEvents.slice().reverse().find((event) => event.kind === "assistant") ??
                        builtMessageEvents.at(-1);
                    const finalContent = finalAgentEvent?.content ?? "";

                    const schemaId = node.output.schemaId as keyof typeof nodeOutputSchemaRegistry;
                    const schema = nodeOutputSchemaRegistry[schemaId];
                    if (!schema) {
                        throw new Error(`Unknown schemaId: ${node.output.schemaId}`);
                    }

                    if (schemaId === "conversational") {
                        // Conversational nodes: wrap the agent's text response directly.
                        // No JSON parsing — the LLM output is natural language.
                        validated = schema.parse({ response: finalContent, rawContent: finalContent });
                    } else {
                        let parsed: unknown = parseJsonOutput(finalContent);
                        parsed = await maybeExecuteJsonActionTool({
                            schemaId: String(schemaId),
                            parsed,
                            allowedToolNames: node.react.toolNames ?? [],
                            phaseId: node.id,
                            phaseLabel: node.label,
                            makeEventId: nextGlobalEventId,
                            pushEvent: (event) => {
                                globalEventStream.push(event);
                                eventStream.push(event);
                            },
                            invokeToolByName: async (name, args) => {
                                const invoker = toolInvokerMap.get(name);
                                if (!invoker) {
                                    return `Tool ${name} is not available in this node.`;
                                }
                                return await invoker(args);
                            },
                            ensureActive: ensureNotAborted,
                        });
                        validated = schema.parse(parsed);
                        if (node.output?.schemaId === "cursor_planner_output") {
                            const missionText =
                                (typeof (state as any).mission === "string" && (state as any).mission) ||
                                (typeof (state as any).userInput === "string" && (state as any).userInput) ||
                                "";
                            validated = ensurePlannerOutput(validated, missionText) as typeof validated;
                        }
                    }
                }

                state.nodes[node.id] = validated as any;
                if (node.output?.statePath) {
                    setNestedValue(state as any, node.output.statePath, validated, {
                        merge: node.output?.stateMerge,
                    });
                }
                await agentGraphRunService.updateRunState(runId, cloneValue(state));
                await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "COMPLETED");

                // Persist node-level token usage
                const nodeTokenUsage = tokenUsageService.getNodeUsage(runId, nodeId);
                await agentGraphRunService.updateNodeTokenUsage(runId, nodeId, nodeTokenUsage);

                timeline[0].status = "success";
                timeline[0].summary = "Node execution (done)";
                timeline[0].endedAt = new Date().toISOString();
                await flushUpdate();

                if (timelineEntry) {
                    timelineEntry.status = "success";
                    timelineEntry.summary = "Done";
                    timelineEntry.endedAt = new Date().toISOString();
                    timelineEntry.tokenUsage = nodeTokenUsage.totalTokens > 0 ? {
                        inputTokens: nodeTokenUsage.inputTokens,
                        outputTokens: nodeTokenUsage.outputTokens,
                        totalTokens: nodeTokenUsage.totalTokens,
                    } : undefined;
                }
                await emitUpdate();

                const finalResult: AgentWorkflowResult = {
                    sessionId: runId,
                    timeline,
                    conclusion: "Node completed.",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: JSON.stringify(validated, null, 2),
                        meta: { runId, nodeId: node.id },
                    }),
                    eventStream,
                };

                if (executionMode === "state_machine") {
                    const nextNodes = selectNextNodes(nodeId);
                    if (nextNodes.length) {
                        pendingNodeIds.push(...nextNodes);
                    }
                }
            } catch (err: any) {
                if (err instanceof AgentWorkflowAbortError || err?.name === "AgentWorkflowAbortError") {
                    const reason: AgentWorkflowAbortReason = err.reason ?? "PAUSED";
                    const status = reason === "CANCELLED" ? "CANCELLED" : "PAUSED";
                    const { summary: runTokenUsage } = tokenUsageService.finalizeRunTracking(runId);
                    await agentGraphRunService.updateRunTokenUsage(runId, runTokenUsage);
                    await agentGraphRunService.updateRunStatus(runId, status as any, {
                        endedAt: new Date(),
                        error: err?.message ?? String(err),
                    } as any);

                    if (timelineEntry) {
                        timelineEntry.status = "error";
                        timelineEntry.summary = reason === "PAUSED" ? "Paused" : "Cancelled";
                        timelineEntry.endedAt = new Date().toISOString();
                    }
                    await emitUpdate();
                    throw err;
                }

                await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "FAILED");
                await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                    endedAt: new Date(),
                    error: err?.message ?? String(err),
                } as any);

                timeline[0].status = "error";
                timeline[0].summary = `Failed: ${err?.message ?? "unknown error"}`;
                timeline[0].endedAt = new Date().toISOString();
                await flushUpdate();

                if (timelineEntry) {
                    timelineEntry.status = "error";
                    timelineEntry.summary = `Failed: ${err?.message ?? "unknown error"}`;
                    timelineEntry.endedAt = new Date().toISOString();
                }
                await emitUpdate();

                const finalResult: AgentWorkflowResult = {
                    sessionId: runId,
                    timeline,
                    conclusion: "Node failed.",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: ${err?.message ?? String(err)}`,
                        meta: { runId, nodeId: node.id },
                    }),
                    eventStream,
                };
                return {
                    sessionId: runId,
                    timeline: globalTimeline,
                    conclusion: "Run failed.",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: ${err?.message ?? String(err)}`,
                        meta: { runId, graphId: run.graphId.toString(), state: cloneValue(state) },
                    }),
                    eventStream: globalEventStream,
                };
            }
        }

        // Finalize token usage tracking and persist run-level summary
        const { summary: runTokenUsage } = tokenUsageService.finalizeRunTracking(runId);
        await agentGraphRunService.updateRunTokenUsage(runId, runTokenUsage);

        await agentGraphRunService.updateRunStatus(runId, "COMPLETED", {
            endedAt: new Date(),
        } as any);

        // Enhance the workflow result with formatted outputs and metrics
        const enhancedResult = enhanceWorkflowResult({
            sessionId: runId,
            timeline: globalTimeline,
            conclusion: "Run completed.",
            outputs: createPlaceholderOutputs({
                mission: typeof state.mission === "string" ? state.mission : "",
                report: JSON.stringify(state.nodes ?? {}, null, 2),
                meta: { runId, graphId: run.graphId.toString(), state: cloneValue(state) },
            }),
            eventStream: globalEventStream,
        });

        const successResult = enhancedResult;
        await emitUpdate();
        return successResult;
        });
    }
}

export const agentGraphExecutor = new AgentGraphExecutor();
