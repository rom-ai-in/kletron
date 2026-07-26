import { BaseMessage } from "@langchain/core/messages";
import { tool as createTool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { AgentEvent, AgentEventKind, AgentWorkflowResult, AgentWorkflowUpdate, TimelineEvent, AgentWorkflowAbortReason, Finding } from "@kletron/shared/types";
import type { AgentStreamKpiV1 } from "@kletron/shared/chatTypes";
import { enhanceWorkflowResult } from "@kletron/shared/reportUtils";
import { streamReactAgentMessages, AgentWorkflowAbortError } from "@kletron/agent-core/reactAgentRunner";
import { allMcpTools } from "@kletron/agent-core/tools/mcpTools";
import { agentGraphRunService } from "./agentGraphRunService";
import { agentGraphService } from "./agentGraphService";
import type { AgentGraphNode } from "./agentGraphTypes";
import type { LlmProviderType } from "@kletron/shared/schemas/llmConfig.schema";
import { nodeOutputSchemaRegistry } from "@kletron/shared/nodeOutputSchemas";
import { findExistingMissionUserEvent, parseJsonOutput, renderUserPrompt } from "./agentGraphUtils";
import { buildInitialState, getGraphNodeOrder, resolveExecutionMode } from "./agentGraphRuntime";
import { setNestedValue } from "./agentGraphState";
import { skillRegistry } from "@kletron/agent-core/skills/registry";
import type { ResolvedSkill, SkillDefinition } from "@kletron/agent-core/skills/types";
import { loadAllSkillsForRegistry } from "./skillsService";
import { resolveWorkspaceCapabilities, type WorkspaceCapabilities } from "./workspaceCapabilityResolver";
import { effectiveToolNames } from "./effectiveToolNames";
import { buildTaskToolDescription, listSubagents } from "./subagentRegistry";
import { SubagentSemaphore, runSubagent } from "./subagentRunner";
import { applySkillSlashPreflight, mergeLoadedSkillIds } from "./skillSlashPreflight";
import {
    listWorkspaceSkillRecords,
    skillRecordToSkillDefinition,
} from "./workspaceSkillFiles";
import { buildDynamicExternalTools } from "@kletron/agent-core/tools/dynamicExternalTools";
import { KLETRON_ADMIN_TOOL_NAMES } from "@kletron/agent-core/tools/kletronAdminToolNames";
import { kletronAdminTools } from "@kletron/agent-core/tools/kletronAdminTools";
import { tokenUsageService } from "./tokenUsageService";
import { ObjectId } from "mongodb";
import { getWorkspaceContextConfig, type WorkspaceContextConfig } from "@kletron/server/services/auditContextService";
import { formatAuditContextPrompt } from "@kletron/shared/documentContext";
import { DEFAULT_WORKSPACE_CONTEXT_INJECTION } from "@kletron/shared/workspaceContextInjection";
import { agentMemoryService } from "./agentMemoryService";
import { ensureConversationSummary, formatConversationSummaryPrompt } from "./conversationSummaryService";
import { syncDerivedMemories } from "./derivedMemorySyncService";
import {
    formatRunContextPrompt,
    resolveRuntimeProfileContext,
} from "./runtimeProfileContextService";
import { SafeEditGate } from "./agent/SafeEditGate";
import type { ToolApprovalConfig } from "./toolApprovalPolicy";
import { applyThreadApprovalOverride, getToolApprovalPolicy } from "./toolApprovalPolicy";
import { resolveEffectiveToolApprovalConfigForRun } from "./effectiveToolApprovalService";
import { syncWorkspaceExternalMcpServers } from "./mcpWorkspaceSync";
import { parseToolInputWithRepair } from "./toolInputRepair";
import { simpleReactPhaseId, simpleReactWorkSystemPrompt } from "./agentGraphPresets";
import { config } from "../config";
import { RESEARCH_DEPTH_FAST_SYSTEM_SUFFIX } from "@kletron/shared/researchDepth";
import { toolsUnlockedByConnectors } from "@kletron/shared";
import { convertConversationHistoryToMessages } from "./conversationHistoryToMessages";

const runApprovalConfigCache = new Map<string, ToolApprovalConfig>();

async function getCachedRunApprovalConfig(runId: string): Promise<ToolApprovalConfig> {
    const hit = runApprovalConfigCache.get(runId);
    if (hit) return hit;
    const cfg = await resolveEffectiveToolApprovalConfigForRun(runId);
    runApprovalConfigCache.set(runId, cfg);
    return cfg;
}
import { sanitizeAssistantVisibleContent, stripThoughtTagsForTranscript } from "./titleSanitizer";

// --- Checkpoint Imports ---
import { getCheckpointSaver, hasCheckpoint, computeGraphHash, deleteThreadCheckpoints } from "./checkpointService";

// --- Context Management Imports ---
import { contextScanner } from "@kletron/server/context/graph/ContextScanner";
import { getEditorStateManager } from "@kletron/server/context/graph/EditorStateManager";
import { getContextGraphStore } from "@kletron/server/context/graph/contextGraphRegistry";
import {
  buildContextBundle,
  formatContextBundleForPrompt,
} from "@kletron/server/context/contextBundleService";
import { getWorkspaceByIdUnsafe, listAllWorkspaces } from "./workspaceService";
import { runWithWorkspaceContext } from "@kletron/server/workspace/workspaceContext";


let mongoSkillBridgeAttached = false;
function ensureMongoSkillBridge(): void {
    if (mongoSkillBridgeAttached) return;
    mongoSkillBridgeAttached = true;
    skillRegistry.registerProvider(async (): Promise<SkillDefinition[]> => {
        try {
            const rows = await loadAllSkillsForRegistry();
            return rows.map((r) => ({
                id: r.slug,
                name: r.name,
                version: r.version,
                description: r.description,
                systemPromptPrefix: r.body.trim() ? r.body : undefined,
                requiredTools: r.requiredTools.length ? r.requiredTools : undefined,
                suggestedTools: r.suggestedTools.length ? r.suggestedTools : undefined,
                extends: r.extends.length ? r.extends : undefined,
                tags: r.tags.length ? r.tags : undefined,
            }));
        } catch (error) {
            console.warn(
                "[agentGraphExecutor] Mongo skill bridge unavailable:",
                (error as Error).message
            );
            return [];
        }
    });
}
ensureMongoSkillBridge();

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

class ToolApprovalPauseError extends Error {
    toolName: string;
    approvalId: string;

    constructor(toolName: string, approvalId: string) {
        super(`Tool ${toolName} is awaiting approval (${approvalId}).`);
        this.name = "ToolApprovalPauseError";
        this.toolName = toolName;
        this.approvalId = approvalId;
    }
}

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
    const relativeDir = path.join(".kletron", "agent-cache", opts.runId);
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

function currentThreadTimeZone(): string {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    if (resolved) return resolved;
    const envTz = process.env.TZ?.trim();
    return envTz || "UTC";
}

function buildWorkDateGroundingBlock(now: Date, timeZone: string): string {
    const localDate = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
    const localTime = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(now);
    const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "long",
    }).format(now);
    return [
        "## DATE AND TIME GROUNDING",
        `- Current local date: ${localDate} (${weekday})`,
        `- Current local time: ${localTime}`,
        `- Reference timezone: ${timeZone}`,
        `- Current UTC timestamp: ${now.toISOString()}`,
        "- Resolve relative references like today, tomorrow, and yesterday strictly from that timezone.",
        "- When answering about schedules or creating calendar events, restate the absolute date explicitly before acting.",
        "- Do not trust stale workspace notes for the current date when they conflict with the grounded date above.",
    ].join("\n");
}

const describeMessageContent = (message: BaseMessage): string => {
    if (typeof message.content === "string") {
        return message.content;
    }
    // Handle array content blocks (Claude format: [{type:"thinking",...},{type:"text",...}])
    if (Array.isArray(message.content)) {
        const textBlocks = (message.content as any[])
            .filter((block) => block?.type === "text" && typeof (block as { text?: string }).text === "string")
            .map((block) => (block as { text: string }).text);
        if (textBlocks.length > 0) {
            return textBlocks.join("\n");
        }
        // Fallback: concatenate all string-like content, skip thinking blocks
        const allText = (message.content as any[])
            .filter((block) => block?.type !== "thinking")
            .map((block) => {
                if (typeof block === "string") return block;
                if (block && typeof block === "object" && "text" in block && typeof (block as { text?: string }).text === "string") {
                    return (block as { text: string }).text;
                }
                return "";
            })
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

    // Strip closed thinking blocks (already extracted by extractThinkingFromMessage for structured runs)
    cleaned = cleaned.replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/gi, "").trim();
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
    if (paragraphs.length >= 3) {
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
    const toolMessageStatus = isToolResult ? (message as any).status : undefined;
    const isToolError = toolMessageStatus === "error";
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
        content = sanitizeAssistantVisibleContent(content);
        if (!content) {
            return {
                id: eventId,
                phaseId,
                phaseLabel,
                kind,
                role,
                name: guessToolName(message),
                toolCallId: extractToolCallId(message),
                content: "",
                toolNote,
                toolArgs,
                timestamp: new Date().toISOString(),
            };
        }
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
        isError: isToolError || undefined,
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
function _createFormattedReport(result: AgentWorkflowResult): {
    markdown?: string;
    json?: string;
    summary?: string;
} {
    const outputs = result.outputs || {};
    const timeline = result.timeline || [];
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

function selectToolsByName(
    toolNames: string[],
    extraTools: any[] = [],
    dynamicTools: any[] = []
) {
    const allow = new Set(toolNames ?? []);
    const merged = [...allMcpTools, ...extraTools, ...dynamicTools];
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

/** One background scan per workspace — avoids duplicate scans when multiple runs start together. */
const contextGraphBackgroundScan = new Map<string, Promise<void>>();
const CONTEXT_GRAPH_SYNC_SCAN_BUDGET_MS = 250;

/**
 * Returns the context graph store quickly for the first LLM call.
 * If the graph is empty after disk load, a **background** workspace scan runs
 * instead of blocking send → LM Studio on a full tree walk.
 */
async function ensureContextGraphReady(workspaceId: string, rootPath: string) {
    const store = getContextGraphStore(workspaceId, rootPath);
    if (store.getAllNodes().length > 0) return store;

    console.log("[AgentGraph] Context graph is empty, attempting load...");
    await store.load();

    if (store.getAllNodes().length > 0) return store;

    const scanKey = workspaceId;
    let work = contextGraphBackgroundScan.get(scanKey);
    if (!work) {
        work = (async () => {
            try {
                console.log(
                    "[AgentGraph] Context graph still empty after load; workspace scan started..."
                );
                await contextScanner.scanWorkspace(rootPath, store);
                await store.save();
                console.log(`[AgentGraph] Workspace scan complete. Graph now has ${store.getAllNodes().length} nodes.`);
            } catch (err) {
                console.warn("[AgentGraph] Background context scan failed:", (err as Error)?.message ?? err);
            } finally {
                contextGraphBackgroundScan.delete(scanKey);
            }
        })();
        contextGraphBackgroundScan.set(scanKey, work);
    }
    const syncAttempt = await Promise.race([
        work.then(() => true).catch(() => false),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), CONTEXT_GRAPH_SYNC_SCAN_BUDGET_MS)),
    ]);
    if (!syncAttempt) {
        console.log(
            `[AgentGraph] Context graph scan still running after ${CONTEXT_GRAPH_SYNC_SCAN_BUDGET_MS}ms; continuing with partial context.`,
        );
    }
    return store;
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
            onReasoningDelta?: (delta: string) => void;
            llmSelectionOverride?: { provider: LlmProviderType; model?: string };
            shouldAbort?: () => Promise<AgentWorkflowAbortReason | null> | AgentWorkflowAbortReason | null;
            /** Override audit/tool identity (e.g. channel-linked user). Defaults to workspace.ownerId. */
            workspaceContextUserId?: string;
            onLlmStreamKpi?: (kpi: AgentStreamKpiV1) => void;
            clientSentAtMs?: number;
            serverRequestReceivedAtMs?: number;
            /** Synthetic events appended to conversation history without inventing a user turn. */
            historyEvents?: AgentEvent[];
            /** Preserve the current mission/userInput instead of deriving one from `message`. */
            preserveMission?: boolean;
            /** Skip conversation turn accounting for synthetic continuations. */
            countAsConversationTurn?: boolean;
        }
    ): Promise<AgentWorkflowResult> {
        console.log(`[AgentGraphExecutor] continueRun: runId=${runId}, message="${message.slice(0, 40)}"`);
        const run = await agentGraphRunService.getRun(runId);
        if (!run) throw new Error(`Run ${runId} not found`);
        console.log(
            `[AgentGraphExecutor] continueRun: run status="${run.status}", graphId=${run.graphId}, workspaceId=${run.workspaceId}`
        );

        // Resolve and bind the workspace for this continuation. This ensures that
        // all downstream tooling (MCP, git, semantic index, etc.) sees a stable
        // workspace context even if the user changed the global active workspace
        // between turns.
        const workspaceId = run.workspaceId?.toString() ?? null;
        const workspace = workspaceId
            ? await getWorkspaceByIdUnsafe(workspaceId)
            : (await listAllWorkspaces())[0];
        if (!workspace || !workspace._id) {
            throw new Error("Workspace not found for run continuation.");
        }

        return await runWithWorkspaceContext(
            workspace,
            async () => {

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

            const syntheticHistory = Array.isArray(opts?.historyEvents) ? opts.historyEvents : [];
            const preserveMission = opts?.preserveMission === true || syntheticHistory.length > 0;
            const skipTurnIncrement = opts?.countAsConversationTurn === false || syntheticHistory.length > 0;

            const preflight = preserveMission
                ? {
                    mission:
                        (typeof run.state.mission === "string" && run.state.mission) ||
                        (typeof run.state.userInput === "string" && run.state.userInput) ||
                        message,
                    loadedSkillIdsToAppend: [] as string[],
                }
                : await applySkillSlashPreflight(
                    message,
                    workspace._id!.toString()
                );
            const mergedLoaded = mergeLoadedSkillIds(run.state.loadedSkillIds, preflight.loadedSkillIdsToAppend);
            const prevLoaded = new Set(run.state.loadedSkillIds ?? []);
            const newSlashSlugs = preflight.loadedSkillIdsToAppend.filter((id) => !prevLoaded.has(id));
            const slashSkillLoads =
                newSlashSlugs.length > 0
                    ? newSlashSlugs.map((slug) => ({
                          slug,
                          at: new Date().toISOString(),
                          reason: "slash_preflight" as const,
                      }))
                    : [];

            // Append user message to conversation history
            const history = run.state.conversationHistory ?? [];
            if (syntheticHistory.length > 0) {
                history.push(...syntheticHistory);
            } else {
                history.push({
                    id: `event-continue-${Date.now()}`,
                    phaseId: "user",
                    phaseLabel: "User input",
                    kind: "user",
                    role: "user",
                    content: message,
                    timestamp: new Date().toISOString(),
                });
            }

            // Update state with new mission and conversation history
            const updatedState = {
                ...run.state,
                mission:
                    preserveMission
                        ? (
                            (typeof run.state.mission === "string" && run.state.mission) ||
                            (typeof run.state.userInput === "string" && run.state.userInput) ||
                            preflight.mission
                        )
                        : preflight.mission,
                userInput:
                    preserveMission
                        ? (
                            (typeof run.state.userInput === "string" && run.state.userInput) ||
                            (typeof run.state.mission === "string" && run.state.mission) ||
                            preflight.mission
                        )
                        : preflight.mission,
                conversationHistory: history,
                loadedSkillIds: mergedLoaded,
                skillLoads: [...(run.state.skillLoads ?? []), ...slashSkillLoads],
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

            if (!skipTurnIncrement) {
                await agentGraphRunService.incrementConversationTurns(runId);
            }

            return this.executeRunStreaming(runId, opts);
            },
            { userId: opts?.workspaceContextUserId ?? workspace.ownerId, runId }
        );
    }

    async executeRunStreaming(
        runId: string,
        opts?: {
            onUpdate?: (update: AgentWorkflowUpdate) => Promise<void> | void;
            /** Progressive text streaming callback — emits token-by-token text deltas */
            onTextDelta?: (delta: string) => void;
            /** Reasoning / thinking deltas (e.g. Claude extended thinking blocks) */
            onReasoningDelta?: (delta: string) => void;
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
            /** Override audit/tool identity (e.g. channel-linked user). Defaults to workspace.ownerId. */
            workspaceContextUserId?: string;
            /** Fires once per `streamReactAgentMessages` completion (NDJSON / logs). */
            onLlmStreamKpi?: (kpi: AgentStreamKpiV1) => void;
            clientSentAtMs?: number;
            serverRequestReceivedAtMs?: number;
        }
    ): Promise<AgentWorkflowResult> {
        console.log(`[AgentGraphExecutor] executeRunStreaming: runId=${runId}`);
        const run = await agentGraphRunService.getRun(runId);
        if (!run) throw new Error(`Run ${runId} not found`);
        console.log(`[AgentGraphExecutor] executeRunStreaming: status="${run.status}", graphId=${run.graphId}, workspaceId=${run.workspaceId}`);
        const runSource = String(run.source ?? "unknown");

        const workspaceId = run.workspaceId?.toString() ?? null;
        const workspace = workspaceId
            ? await getWorkspaceByIdUnsafe(workspaceId)
            : (await listAllWorkspaces())[0];
        if (!workspace || !workspace._id) {
            throw new Error("Workspace not found for run execution.");
        }

        return await runWithWorkspaceContext(
            workspace,
            async () => {
            let diskSkillRegistryOverlay = false;
            try {
            const runWallClockT0 = performance.now();
            type PrepMetricKey =
                | "contextGraphReadyMs"
                | "workspaceContextConfigMs"
                | "workspaceCapabilitiesMs"
                | "graphLoadMs"
                | "runtimeProfileMs"
                | "derivedMemorySyncMs"
                | "externalToolingMs"
                | "diskSkillsMs"
                | "conversationSummaryMs"
                | "contextBundleMs"
                | "contextBundleGraphMs"
                | "contextBundleVectorMs";
            const prepTimings: Partial<Record<PrepMetricKey, number>> = {};
            const timedStage = async <T>(key: PrepMetricKey, work: () => Promise<T>): Promise<T> => {
                const t0 = performance.now();
                try {
                    return await work();
                } finally {
                    prepTimings[key] = performance.now() - t0;
                }
            };
            const emitLlmKpi = (kpi: AgentStreamKpiV1 | undefined) => {
                if (!kpi) return;
                opts?.onLlmStreamKpi?.({
                    ...kpi,
                    ...prepTimings,
                    wallMsExecutorToStreamEnd: performance.now() - runWallClockT0,
                });
            };
            const workspaceIdStr = workspace._id!.toString();
            const rootPathForCtx = workspace.rootPath;

            const loadGraphForRun = async () => {
                let g = await agentGraphService.getGraph(run.graphId.toString());
                if (!g) {
                    const allGraphs = await agentGraphService.listGraphs();
                    g = allGraphs[0] ?? null;
                    if (!g) throw new Error(`No agent graphs available`);
                    console.warn(`[AgentGraph] Graph ${run.graphId.toString()} not found, falling back to "${g.name}"`);
                }
                return g;
            };

            const [
                workspaceFullCtxResult,
                workspaceCapsResult,
                graph,
            ] = await Promise.all([
                timedStage("workspaceContextConfigMs", () =>
                    getWorkspaceContextConfig(workspaceIdStr).catch((err) => {
                        console.warn("[AgentGraph] Failed to load workspace context config:", err);
                        return null as WorkspaceContextConfig | null;
                    })
                ),
                timedStage("workspaceCapabilitiesMs", () =>
                    resolveWorkspaceCapabilities(workspaceIdStr).catch((capsErr) => {
                        console.warn(
                            "[AgentGraph] Failed to resolve workspace capabilities, falling back to permissive mode:",
                            (capsErr as Error)?.message ?? capsErr
                        );
                        return null as WorkspaceCapabilities | null;
                    })
                ),
                timedStage("graphLoadMs", loadGraphForRun),
            ]);

            const workspaceFullCtx = workspaceFullCtxResult;
            const workspaceCaps = workspaceCapsResult;

            // ── Checkpoint saver ─────────────────────────────────────────────
            // Only enable checkpoints when explicitly requested (e.g. when a
            // node has interruptBeforeTools configured for human-in-the-loop).
            // Default OFF to avoid wasteful storage on every run.
            const enableCheckpoints = opts?.enableCheckpoints === true;
            let checkpointer: import("@langchain/langgraph").BaseCheckpointSaver | undefined;
            if (enableCheckpoints) {
                try {
                    checkpointer = await getCheckpointSaver();
                } catch (err) {
                    console.warn("[AgentGraph] Checkpointer unavailable, continuing without:", (err as Error)?.message);
                }
            }

            // Helper: clean up checkpoint data for this run (fire-and-forget).
            // Called on COMPLETED and FAILED — NOT on PAUSED (needs checkpoints for resume).
            const cleanupCheckpoints = () => {
                if (checkpointer) {
                    deleteThreadCheckpoints(runId).catch((err) =>
                        console.warn(`[AgentGraph] Checkpoint cleanup for ${runId} failed:`, (err as Error)?.message)
                    );
                }
            };

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

            const injectionSettings = workspaceFullCtx?.injection ?? DEFAULT_WORKSPACE_CONTEXT_INJECTION;
            const documentContextEnabled = workspaceFullCtx?.enabled !== false;
            const auditContext = documentContextEnabled ? workspaceFullCtx?.context ?? null : null;
            const wantAutoContext =
                injectionSettings.structuralInjectionEnabled || injectionSettings.semanticInjectionEnabled;
            const workspaceGraphStore = wantAutoContext
                ? await timedStage("contextGraphReadyMs", () => ensureContextGraphReady(workspaceIdStr, rootPathForCtx))
                : null;
            const runWorkMode = await agentGraphRunService.getRunWorkMode(runId);

            const executionMode = resolveExecutionMode(graph);
            const timelineNodeIds = (run.nodeOrder?.length ? run.nodeOrder : getGraphNodeOrder(graph)).slice();
            if (!run.nodeOrder?.length) {
                await agentGraphRunService.setNodeOrder(runId, timelineNodeIds);
            }

            const state = cloneValue(run.state ?? { nodes: {} });
            if (!state.nodes) state.nodes = {};
            if (!state.contextAssembly) state.contextAssembly = {};

            const runtimeProfileUserId =
                opts?.workspaceContextUserId ??
                run.createdByUserId ??
                workspace.ownerId ??
                undefined;
            const runtimeProfile = await timedStage("runtimeProfileMs", () =>
                resolveRuntimeProfileContext({
                    workspaceId: workspaceIdStr,
                    workspaceName: workspace.name,
                    userId: runtimeProfileUserId,
                    graph,
                    workMode: runWorkMode,
                    documentContext: auditContext,
                    enabledIntegrationProviderIds: workspaceCaps?.enabledIntegrationProviderIds ?? [],
                })
            );
            try {
                const memorySync = await timedStage("derivedMemorySyncMs", () =>
                    syncDerivedMemories({
                        workspaceId: workspaceIdStr,
                        runtimeProfile,
                    })
                );
                state.contextAssembly.derivedMemorySync = memorySync;
            } catch (err) {
                console.warn("[AgentGraph] Failed to sync derived memories:", (err as Error)?.message ?? err);
            }
            const workspaceObjectId =
                workspace._id && ObjectId.isValid(workspace._id.toString()) ? new ObjectId(workspace._id.toString()) : undefined;
            const rootDir = workspace.rootPath;

            // Sync external MCP and load disk skills in parallel — both were previously sequential
            // bottlenecks before the first LLM call.
            let dynamicExternalTools: any[] = [];
            let externalNamespacedToolNames: string[] = [];
            const [mcpPack, diskRecs] = await Promise.all([
                timedStage("externalToolingMs", async (): Promise<{ dynamicExternalTools: any[]; externalNamespacedToolNames: string[] }> => {
                    let tools: any[] = [];
                    let names: string[] = [];
                    if (workspaceCaps?.externalMcpServers?.length) {
                        try {
                            await syncWorkspaceExternalMcpServers(workspaceIdStr);
                            tools = await buildDynamicExternalTools(workspaceIdStr);
                            names = tools.map((t: any) => String(t?.name ?? ""));
                        } catch (extErr) {
                            console.warn(
                                "[AgentGraph] External MCP sync failed:",
                                (extErr as Error)?.message ?? extErr
                            );
                        }
                    } else if (workspaceCaps) {
                        try {
                            await syncWorkspaceExternalMcpServers(workspaceIdStr);
                        } catch {
                            // ignore
                        }
                    }
                    return { dynamicExternalTools: tools, externalNamespacedToolNames: names };
                }),
                timedStage(
                    "diskSkillsMs",
                    () =>
                        rootDir
                            ? listWorkspaceSkillRecords(rootDir).catch((diskErr) => {
                                  console.warn(
                                      "[AgentGraph] Failed to load .kletron/skills overlay:",
                                      (diskErr as Error)?.message ?? diskErr
                                  );
                                  return [] as Awaited<ReturnType<typeof listWorkspaceSkillRecords>>;
                              })
                            : Promise.resolve([] as Awaited<ReturnType<typeof listWorkspaceSkillRecords>>)
                ),
            ]);
            dynamicExternalTools = mcpPack.dynamicExternalTools;
            externalNamespacedToolNames = mcpPack.externalNamespacedToolNames;
            for (const r of diskRecs) {
                skillRegistry.upsertSkill(skillRecordToSkillDefinition(r));
            }
            diskSkillRegistryOverlay = diskRecs.length > 0;

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

            /** Max runtime-loaded skills per session (load_skill + slash preflight). */
            const RUNTIME_MAX_LOADED_SKILLS = 20;
            const enabledWorkspaceSkillSlugs = new Set(
                (workspaceCaps?.enabledSkills ?? []).map((s) => s.slug)
            );

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

            const listAvailableSkillsTool = createTool(
                async () => {
                    const skills = workspaceCaps?.enabledSkills ?? [];
                    return JSON.stringify(
                        skills.map((s) => ({
                            slug: s.slug,
                            name: s.name,
                            description: s.description,
                        })),
                        null,
                        2
                    );
                },
                {
                    name: "list_available_skills",
                    description:
                        "List skills enabled for this workspace (slug, name, short description). Call before load_skill to pick a specialization.",
                    schema: z.object({}),
                }
            );

            const loadSkillTool = createTool(
                async (input: { skill_id: string; reason?: string }) => {
                    const skillId = input.skill_id?.trim() ?? "";
                    if (!skillId) {
                        return JSON.stringify({ ok: false, error: "skill_id is required" }, null, 2);
                    }
                    if (!enabledWorkspaceSkillSlugs.has(skillId)) {
                        return JSON.stringify(
                            {
                                ok: false,
                                error: `Skill "${skillId}" is not enabled for this workspace. Use list_available_skills for eligible slugs.`,
                            },
                            null,
                            2
                        );
                    }
                    const currentLoaded = ((state as any).loadedSkillIds as string[] | undefined) ?? [];
                    const already = currentLoaded.includes(skillId);
                    if (!already && currentLoaded.length >= RUNTIME_MAX_LOADED_SKILLS) {
                        return JSON.stringify(
                            {
                                ok: false,
                                error: `At most ${RUNTIME_MAX_LOADED_SKILLS} skills can be loaded in one session.`,
                            },
                            null,
                            2
                        );
                    }
                    try {
                        const resolved = await skillRegistry.getSkill(skillId);
                        if (!already) {
                            (state as any).loadedSkillIds = [...currentLoaded, skillId];
                            const loads = [...(((state as any).skillLoads as Array<{ slug: string; at: string; reason?: string }>) ?? [])];
                            loads.push({
                                slug: skillId,
                                at: new Date().toISOString(),
                                reason:
                                    input.reason && input.reason.trim()
                                        ? input.reason.trim()
                                        : "load_skill",
                            });
                            (state as any).skillLoads = loads;
                            await persistState();
                        }
                        return JSON.stringify(
                            {
                                ok: true,
                                skill_id: skillId,
                                already_loaded: already,
                                name: resolved.name,
                                description: resolved.description,
                                extendsChain: resolved.extendsChain,
                                requiredTools: resolved.requiredTools ?? [],
                                suggestedTools: resolved.suggestedTools ?? [],
                                resolvedTools: resolved.resolvedTools,
                                resolvedSystemPrompt: resolved.resolvedSystemPrompt,
                            },
                            null,
                            2
                        );
                    } catch (err) {
                        return JSON.stringify(
                            {
                                ok: false,
                                error: (err as Error)?.message ?? String(err),
                            },
                            null,
                            2
                        );
                    }
                },
                {
                    name: "load_skill",
                    description:
                        "Load a workspace-enabled skill by slug. Returns full resolved instructions; session remembers loaded skills for later turns.",
                    schema: z.object({
                        skill_id: z.string().describe("Skill slug from list_available_skills"),
                        reason: z.string().optional(),
                    }),
                }
            );

            // ── `task`: delegate to subagents with isolated context windows ───
            // Subagents are resolved from this workspace's own graphs (those with
            // `subagent.key`), so the graph editor doubles as the subagent editor.
            // Parallelism is free: LangGraph's ToolNode dispatches the tool calls of
            // a single assistant turn with `Promise.all`, so N `task` calls emitted
            // together actually run together — bounded by the semaphore below.
            const availableSubagents = config.subagents.enabled
                ? await listSubagents(workspace._id?.toString()).catch(() => [])
                : [];
            const subagentSemaphore = new SubagentSemaphore(config.subagents.maxConcurrency);
            let subagentsSpawned = 0;
            let subagentTokensSpent = 0;

            const taskTool = createTool(
                async (input: { description: string; prompt: string; subagent_type: string }) => {
                    const fail = (error: string) => JSON.stringify({ ok: false, error }, null, 2);

                    const subagent = availableSubagents.find((s) => s.key === input.subagent_type);
                    if (!subagent) {
                        return fail(
                            `Unknown subagent_type "${input.subagent_type}". Available: ${availableSubagents
                                .map((s) => s.key)
                                .join(", ") || "(none)"}.`
                        );
                    }
                    if (subagentsSpawned >= config.subagents.maxPerRun) {
                        return fail(
                            `Subagent budget exhausted for this run (${config.subagents.maxPerRun} max). ` +
                                `Do not call \`task\` again — finish with the findings you already have.`
                        );
                    }
                    if (subagentTokensSpent >= config.subagents.tokenCeiling) {
                        return fail(
                            `Subagent token ceiling reached for this run. ` +
                                `Do not call \`task\` again — conclude with what you have.`
                        );
                    }
                    const prompt = String(input.prompt ?? "").trim();
                    if (!prompt) return fail("`prompt` is required and must be self-contained.");

                    const index = subagentsSpawned++;
                    try {
                        const result = await subagentSemaphore.run(() =>
                            runSubagent({
                                parentRunId: runId,
                                subagent,
                                prompt,
                                description: String(input.description ?? "").trim(),
                                index,
                                workspaceId: workspace._id?.toString(),
                                workspaceRoot: rootDir,
                                llmSelection: opts?.llmSelectionOverride,
                                createdByUserId: run.createdByUserId,
                                abortSignal: abortController.signal,
                            })
                        );
                        subagentTokensSpent += result.tokenUsage.totalTokens ?? 0;

                        // Large reports are evicted to disk rather than pasted back
                        // into the caller's context — the point of delegating is to
                        // keep the caller's window small.
                        let text = result.text;
                        if (text.length > TOOL_RESULT_EVICT_CHARS) {
                            const relativePath = await writeEvictedToolResult({
                                rootDir,
                                runId,
                                nodeId: `subagent-${subagent.key}-${index}`,
                                toolName: "task",
                                content: text,
                            });
                            text = `Result was ${text.length} chars and has been written to ${relativePath}. Use read_file to inspect it.`;
                        }

                        return JSON.stringify(
                            {
                                ok: true,
                                subagent_type: subagent.key,
                                description: input.description ?? "",
                                sub_run_id: result.subRunId,
                                steps: result.steps,
                                tokens: result.tokenUsage.totalTokens ?? 0,
                                result: text,
                            },
                            null,
                            2
                        );
                    } catch (err) {
                        return fail(
                            `Subagent "${subagent.key}" failed: ${(err as Error)?.message ?? String(err)}`
                        );
                    }
                },
                {
                    name: "task",
                    description: buildTaskToolDescription(availableSubagents),
                    schema: z.object({
                        description: z
                            .string()
                            .describe("Short label (3-6 words) shown in the UI while the subagent runs"),
                        prompt: z
                            .string()
                            .describe(
                                "The complete, SELF-CONTAINED instruction. The subagent sees none of this " +
                                    "conversation — include every piece of context it needs and state exactly " +
                                    "what you want back."
                            ),
                        subagent_type: z
                            .string()
                            .describe("Key of the subagent to run (see the list in this tool's description)"),
                    }),
                }
            );

            // Always-on Kletron admin tools (graphs/automations/skills/...).
            // Each tool reads identity from `runWithWorkspaceContext` and logs
            // every call to the agent_audit collection. They are gated by zod
            // schemas + safe-edit confirmation, not by skill activation.
            const localTools = [
                writeTodosTool,
                listAvailableSkillsTool,
                loadSkillTool,
                ...(availableSubagents.length ? [taskTool] : []),
                ...kletronAdminTools,
            ];
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
            const existingUserEvent = findExistingMissionUserEvent(
                state.conversationHistory,
                missionContent,
            );

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
                const dropped = (state as { capabilityDroppedTools?: string[] }).capabilityDroppedTools ?? [];
                await opts.onUpdate({
                    timeline: cloneValue(globalTimeline),
                    eventStream: cloneValue(globalEventStream),
                    outputs,
                    capabilityDroppedTools: [...dropped],
                });
            };

            await emitUpdate();

            const pendingNodeIds = timelineNodeIds.slice();
            const maxIterations = graph.execution?.maxIterations ?? 200;
            const maxNodeRuns = graph.execution?.maxNodeRuns ?? 20;

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
                    cleanupCheckpoints();
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
                    cleanupCheckpoints();
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
                    cleanupCheckpoints();
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

                    // ---------------------------------------------------------
                    // 2.5. Skills Injection (pinned graph skillIds + runtime loadedSkillIds)
                    // ---------------------------------------------------------
                    const pinnedSkillIds = node.react.skillIds ?? [];
                    const loadedSkillIds = (state as any).loadedSkillIds as string[] | undefined;
                    let skillPromptPrefix = "";
                    let skillTools: string[] = [];
                    const pinnedResolved: ResolvedSkill[] = [];
                    const loadedResolved: ResolvedSkill[] = [];
                    if (pinnedSkillIds.length > 0) {
                        try {
                            const rs = await skillRegistry.getSkills(pinnedSkillIds);
                            pinnedResolved.push(...rs);
                        } catch (err) {
                            console.warn(`[AgentGraph] Failed to load pinned skills ${pinnedSkillIds.join(", ")}:`, err);
                        }
                    }
                    if (loadedSkillIds?.length) {
                        try {
                            const rs = await skillRegistry.getSkills(loadedSkillIds);
                            loadedResolved.push(...rs);
                        } catch (err) {
                            console.warn(`[AgentGraph] Failed to load runtime skills ${loadedSkillIds.join(", ")}:`, err);
                        }
                    }
                    const promptChunks = [...pinnedResolved, ...loadedResolved]
                        .map((s) => s.resolvedSystemPrompt)
                        .filter(Boolean);
                    if (promptChunks.length > 0) {
                        skillPromptPrefix = promptChunks.join("\n\n---\n\n");
                    }
                    skillTools = [
                        ...new Set([
                            ...pinnedResolved.flatMap((s) => s.resolvedTools),
                            ...loadedResolved.flatMap((s) => s.resolvedTools),
                        ]),
                    ];
                    const workspaceSkillToolNames = [
                        ...new Set((workspaceCaps?.enabledSkills ?? []).flatMap((s) => s.resolvedTools)),
                    ];
                    const skillToolNamesForEffective = [
                        ...new Set([...skillTools, ...workspaceSkillToolNames]),
                    ];
                    /** SaaS connector tools (e.g. sentry_api) must be requestable even if the graph node omits them — capabilities already gate by workspace binding + provider. */
                    const integrationUnlockedToolNames = toolsUnlockedByConnectors(
                        workspaceCaps?.enabledIntegrationProviderIds ?? []
                    );
                    // Resolve the effective tool list using the unified policy.
                    // - Workspace capabilities gate bundled / admin tools.
                    // - Always-on tools (e.g. `write_todos`) bypass the gate.
                    // - External MCP tools (`slug__name`) are added wholesale.
                    const capabilityToolSet = workspaceCaps?.enabledToolSet ?? new Set<string>();
                    // When capabilities couldn't be resolved, fall back to the
                    // full bundled + skill + node set (legacy behaviour).
                    const effectiveCaps = workspaceCaps
                        ? capabilityToolSet
                        : new Set<string>([
                              ...(node.react.toolNames ?? []),
                              ...skillToolNamesForEffective,
                          ]);
                    const effective = effectiveToolNames({
                        nodeToolNames: [
                            ...(node.react.toolNames ?? []),
                            ...integrationUnlockedToolNames,
                        ],
                        skillToolNames: skillToolNamesForEffective,
                        adminToolNames: [...KLETRON_ADMIN_TOOL_NAMES],
                        capabilityToolSet: effectiveCaps,
                        externalNamespacedTools: externalNamespacedToolNames,
                        alwaysOn: [
                            "write_todos",
                            "list_available_skills",
                            "load_skill",
                            // Only expose `task` when this workspace actually has
                            // subagents to delegate to.
                            ...(availableSubagents.length ? ["task"] : []),
                            ...KLETRON_ADMIN_TOOL_NAMES,
                        ],
                    });
                    const mergedToolNames = effective.names;
                    const selectedTools = selectToolsByName(
                        mergedToolNames,
                        localTools,
                        dynamicExternalTools
                    );

                    const researchDepth = await agentGraphRunService.getRunResearchDepth(runId);
                    const webToolsMissing =
                        !mergedToolNames.includes("web_search") && !mergedToolNames.includes("fetch_url");
                    const webHintBlock = webToolsMissing
                        ? "\n\n## AVAILABLE TOOLS NOTE\n`web_search` and `fetch_url` are **not** exposed for this run (workspace capabilities/connectors). Use workspace search and file tools only; **do not** cite or imply live web research you did not perform with an available tool.\n"
                        : "";
                    const sentryHintBlock = mergedToolNames.includes("sentry_api")
                        ? "\n\n## SENTRY\nWhen the user asks about Sentry, incidents, or open issues **without naming an organization**, call **`sentry_api`** once with **`resource`: `\"digest\"`** (or `\"status\"`). **Do not** ask which org/project first unless that tool call fails.\n"
                        : "";
                    const workDateGroundingBlock =
                        runWorkMode === "work"
                            ? buildWorkDateGroundingBlock(new Date(), currentThreadTimeZone())
                            : "";
                    const fastSuffix =
                        researchDepth === "fast" ? RESEARCH_DEPTH_FAST_SYSTEM_SUFFIX : "";
                    const reactRecursionLimit =
                        typeof node.react.recursionLimit === "number" && node.react.recursionLimit > 0
                            ? Math.floor(node.react.recursionLimit)
                            : typeof graph.execution?.maxReactSteps === "number" && graph.execution.maxReactSteps > 0
                              ? Math.floor(graph.execution.maxReactSteps)
                              : researchDepth === "fast"
                                ? 48
                                : config.graphRecursionLimit;

                    if (effective.dropped.length > 0) {
                        console.warn(
                            `[AgentGraph] Node ${node.id} requested ${effective.dropped.length} tool(s) ` +
                                `outside of workspace capabilities: ${effective.dropped.join(", ")}.`
                        );
                    }
                    (state as { capabilityDroppedTools?: string[] }).capabilityDroppedTools = [
                        ...effective.dropped,
                    ];
                    const toolInvokerMap = new Map<string, (input: Record<string, unknown>) => Promise<string>>();

                    // ── Tool call deduplication ──────────────────────────────────
                    // Track recent read-only tool calls to avoid identical re-invocations.
                    // Write tools (write_file, execute_bash, str_replace_editor) are NOT
                    // deduplicated since they have side effects.
                    const DEDUP_CACHE_MAX = 50;
                    const READ_ONLY_DEDUP_TOOLS = new Set([
                        "glob_files",
                        "list_files", "read_file", "read_file_range", "search_code",
                        "repo_metrics", "dependency_info", "describe_structure",
                        "git_log", "git_diff", "git_grep", "git_blame",
                        "semantic_code_search", "structural_search", "symbols_list",
                        "find_symbol", "go_to_definition", "references",
                        "todo_search", "bootstrap_context", "web_search", "fetch_url",
                        "github_api", "sentry_api",
                        "output_format", "write_todos",
                        "list_available_skills", "load_skill",
                        "list_all_skills", "list_skills",
                    ]);
                    const toolCallCache = new Map<string, string>();
                    // Per-tool telemetry for the run timeline.
                    const toolCallSummary = new Map<
                        string,
                        { count: number; errors: number; totalMs: number }
                    >();
                    const recordToolCall = (
                        name: string,
                        startedAt: number,
                        ok: boolean
                    ) => {
                        const elapsed = Math.max(0, Date.now() - startedAt);
                        const entry = toolCallSummary.get(name) ?? {
                            count: 0,
                            errors: 0,
                            totalMs: 0,
                        };
                        entry.count += 1;
                        entry.totalMs += elapsed;
                        if (!ok) entry.errors += 1;
                        toolCallSummary.set(name, entry);
                    };

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
                        // Avoid z.any() — strict OpenAI/LM Studio validators require parameters.properties
                        const schema = baseTool?.schema ?? z.object({}).catchall(z.any());
                        const returnDirect = (baseTool as any)?.returnDirect;
                        const toolImpl = async (rawInput: Record<string, unknown>) => {
                                const input = parseToolInputWithRepair<Record<string, unknown>>(schema, rawInput, name);
                                await ensureNotAborted();
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


                                const threadMode = await agentGraphRunService.getRunThreadApprovalMode(runId);
                                const workMode = await agentGraphRunService.getRunWorkMode(runId);
                                const approvalCfg = await getCachedRunApprovalConfig(runId);
                                const basePolicy = getToolApprovalPolicy({
                                    source: runSource,
                                    toolName: name,
                                    workMode,
                                    approvalConfig: approvalCfg,
                                    ...(name === "execute_bash" && typeof input?.command === "string"
                                        ? { command: input.command as string }
                                        : {}),
                                });
                                const policy = applyThreadApprovalOverride(basePolicy, {
                                    mode: threadMode,
                                    toolName: name,
                                    approvalConfig: approvalCfg,
                                });
                                console.info(
                                    `[ToolApprovalPolicy] runId=${runId} threadMode=${threadMode ?? "inherit"} source=${policy.normalizedSource} tool=${name} decision=${policy.decision} reason="${policy.reason}"`
                                );

                                if (policy.decision !== "auto_approve") {
                                    if (policy.normalizedSource === "automation") {
                                        console.warn(
                                            `[ToolApprovalPolicy] Blocking automation tool call runId=${runId} tool=${name} decision=${policy.decision}`
                                        );
                                        throw new Error(
                                            `Tool ${name} requires manual approval and is not allowed in automation runs.`
                                        );
                                    }
                                    if (policy.decision === "deny") {
                                        throw new Error(`Tool ${name} is denied by approval policy.`);
                                    }
                                    const descriptionText =
                                        name === "write_file"
                                            ? `Write file ${String(input?.filePath ?? "")}`
                                            : name === "str_replace_editor"
                                                ? `Edit file ${String((input as any)?.filePath ?? (input as any)?.path ?? "")}`
                                                : name === "execute_bash"
                                                    ? `Execute command ${String(input?.command ?? "")}`
                                                    : `Run ${name}`;
                                    const approvals = (state as any).approvals ?? {};
                                    const pending = Array.isArray(approvals.pending) ? approvals.pending.slice() : [];
                                    const granted = Array.isArray(approvals.granted) ? approvals.granted.slice() : [];
                                    const approvalKey = buildApprovalKey(name, input);

                                    const existingPending = findApprovalByKey(pending, approvalKey);
                                    if (existingPending) {
                                        throw new ToolApprovalPauseError(name, String(existingPending.id));
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
                                    console.info(
                                        `[ToolApprovalPolicy] runId=${runId} source=${policy.normalizedSource} tool=${name} action=queued_for_approval approvalId=${edit.id}`
                                    );
                                    throw new ToolApprovalPauseError(name, edit.id);
                                }

                                console.info(
                                    `[ToolApprovalPolicy] runId=${runId} source=${policy.normalizedSource} tool=${name} action=auto_approved_execute`
                                );

                                const startedAt = Date.now();
                                let toolOk = true;
                                let result: unknown;
                                try {
                                    result = await invokeBaseTool(baseTool, input);
                                } catch (err) {
                                    toolOk = false;
                                    recordToolCall(name, startedAt, false);
                                    throw err;
                                }
                                recordToolCall(name, startedAt, toolOk);
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
                            };
                        const wrapped = createTool(toolImpl, { name, description, schema, returnDirect });
                        (wrapped as any).invoke = async (input: unknown) => {
                            return await toolImpl((input ?? {}) as Record<string, unknown>);
                        };
                        (wrapped as any).call = async (input: unknown) => {
                            return await toolImpl((input ?? {}) as Record<string, unknown>);
                        };
                        (wrapped as any).func = toolImpl;
                        toolInvokerMap.set(name, async (input: Record<string, unknown>) => {
                            return await (wrapped as any).invoke(input);
                        });
                        return wrapped;
                    };

                    const tools = selectedTools.map(wrapTool);

                    const builtMessageEvents: AgentEvent[] = [];

                    // ── Pre-existing history guard ────────────────────────
                    // Snapshot content fingerprints from conversation history
                    // BEFORE this node execution. Any streaming message whose
                    // content matches a prior event is a replayed historical
                    // message and must be silently skipped.
                    const priorContentFingerprints = new Set<string>();
                    for (const h of state.conversationHistory!) {
                        const fp = `${h.kind}:${(h.content ?? "").trim().slice(0, 500)}`;
                        if (fp.length > 6) priorContentFingerprints.add(fp); // skip trivially empty
                    }

                    const pushEvent = (event: AgentEvent) => {
                        builtMessageEvents.push(event);
                        eventStream.push(event);
                        globalEventStream.push(event);
                        state.conversationHistory!.push(event);
                    };

                    const replaceEventById = (targetId: string, patch: AgentEvent) => {
                        const apply = (arr: AgentEvent[]) => {
                            const i = arr.findIndex((e) => e.id === targetId);
                            if (i >= 0) arr[i] = { ...arr[i], ...patch };
                        };
                        apply(builtMessageEvents);
                        apply(eventStream);
                        apply(globalEventStream);
                        const hist = state.conversationHistory!;
                        const hi = hist.findIndex((e) => e.id === targetId);
                        if (hi >= 0) hist[hi] = { ...hist[hi], ...patch };
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
                                // Skip if this tool-call event matches a prior history entry
                                const tcFp = `assistant:${(tcEvent.content ?? "").trim().slice(0, 500)}`;
                                if (tc.name && priorContentFingerprints.has(tcFp)) continue;
                                pushEvent(tcEvent);
                            }
                            await flushUpdate();
                            return;
                        }

                        // Single or zero tool calls: use standard createAgentEvent
                        const event = createAgentEvent(message, node.id, node.label, nextEventId());

                        // Skip events whose content already exists in the
                        // pre-existing conversation history (replayed history)
                        const eventFp = `${event.kind}:${(event.content ?? "").trim().slice(0, 500)}`;
                        if (
                            eventFp.length > 6 &&
                            priorContentFingerprints.has(eventFp)
                        ) {
                            return; // silently skip — this is a replayed history message
                        }

                        // Values-mode streaming: merge growing assistant text into one event (any provider).
                        const hist = state.conversationHistory!;
                        const last = hist.at(-1);
                        const lastIsPlainAssistant =
                            last &&
                            last.kind === "assistant" &&
                            last.phaseId === node.id &&
                            !(last.name ?? last.toolName) &&
                            !last.toolCallId;
                        const incomingIsPlainAssistant =
                            event.kind === "assistant" &&
                            !(event.name ?? event.toolName) &&
                            !event.toolCallId;
                        const prevTrim = (last?.content ?? "").trim();
                        const nextTrim = (event.content ?? "").trim();
                        if (lastIsPlainAssistant && incomingIsPlainAssistant && nextTrim === prevTrim) {
                            return;
                        }
                        const canMergeGrowingAssistant =
                            lastIsPlainAssistant &&
                            incomingIsPlainAssistant &&
                            nextTrim.length > prevTrim.length &&
                            (prevTrim.length === 0 || nextTrim.startsWith(prevTrim));

                        if (canMergeGrowingAssistant && last) {
                            const merged: AgentEvent = {
                                ...last,
                                content: event.content,
                                thoughts: event.thoughts,
                                toolNote: event.toolNote,
                                thinking: event.thinking,
                                timestamp: event.timestamp,
                            };
                            replaceEventById(last.id, merged);
                            await flushUpdate();
                            return;
                        }

                        pushEvent(event);
                        await flushUpdate();
                    };

                    // ---------------------------------------------------------
                    // 3. Smart Context Injection (New Architecture)
                    // ---------------------------------------------------------
                    const useWorkSimpleReactPrompt =
                        runWorkMode === "work" &&
                        graph.nodes.length === 1 &&
                        (node.kind ?? "react") === "react" &&
                        node.id === simpleReactPhaseId;

                    let recentHistoryForReplay = state.conversationHistory ?? [];
                    let conversationSummaryPrompt: string | null = null;
                    const conversationSummaryT0 = performance.now();
                    try {
                        const summaryContext = ensureConversationSummary(state);
                        recentHistoryForReplay = summaryContext.recentHistory;
                        conversationSummaryPrompt = formatConversationSummaryPrompt(summaryContext.conversationSummary);
                        state.contextAssembly = {
                            ...(state.contextAssembly ?? {}),
                            summaryCoveredEventCount: summaryContext.conversationSummary?.coveredEventCount ?? 0,
                        };
                    } catch (err) {
                        console.warn("[AgentGraph] Failed to build conversation summary:", (err as Error)?.message ?? err);
                        recentHistoryForReplay = (state.conversationHistory ?? []).slice(-30);
                    } finally {
                        prepTimings.conversationSummaryMs = performance.now() - conversationSummaryT0;
                    }

                    let contextBlock = "";
                    if (wantAutoContext && workspaceGraphStore) {
                        const editorState = getEditorStateManager(workspace._id!.toString()).getCurrentState();
                        const bundleT0 = performance.now();
                        const bundle = await buildContextBundle({
                            rootPath: rootDir,
                            userPrompt,
                            editorState,
                            store: workspaceGraphStore,
                            settings: injectionSettings,
                        });
                        prepTimings.contextBundleMs = performance.now() - bundleT0;
                        prepTimings.contextBundleGraphMs = bundle.debug.graphMs;
                        prepTimings.contextBundleVectorMs = bundle.debug.vectorMs;
                        contextBlock = formatContextBundleForPrompt(bundle, {
                            currentFile: editorState.activeFile,
                        });
                        state.contextAssembly = {
                            ...(state.contextAssembly ?? {}),
                            dynamicItemCount: bundle.promptItems.length,
                            dynamicSnippetCount: bundle.promptItems.filter((item) => typeof item.snippet === "string" && item.snippet.trim().length > 0).length,
                        };
                    }

                    // Compose final system prompt: skills prefix + base prompt + ordered runtime context
                    const renderedSystemPrompt = renderUserPrompt(
                        useWorkSimpleReactPrompt ? simpleReactWorkSystemPrompt : node.react.systemPrompt,
                        state
                    );
                    const baseSystemPrompt = skillPromptPrefix
                        ? `${skillPromptPrefix}\n\n---\n\n${renderedSystemPrompt}`
                        : renderedSystemPrompt;
                    const computedRunContextPrompt = formatRunContextPrompt(runtimeProfile);
                    const computedPersistentContextPrompt = auditContext ? formatAuditContextPrompt(auditContext) : null;
                    const computedDynamicContextPrompt = contextBlock ? contextBlock.trim() : null;
                    const existingThreadBootstrap = state.contextAssembly?.threadBootstrap;
                    if (!existingThreadBootstrap) {
                        state.contextAssembly = {
                            ...(state.contextAssembly ?? {}),
                            threadBootstrap: {
                                runContextPrompt: computedRunContextPrompt,
                                persistentContextPrompt: computedPersistentContextPrompt ?? undefined,
                                dynamicContextPrompt: computedDynamicContextPrompt ?? undefined,
                                createdAt: new Date().toISOString(),
                            },
                        };
                    }
                    const threadBootstrap = state.contextAssembly?.threadBootstrap;
                    const runContextPrompt =
                        computedRunContextPrompt || threadBootstrap?.runContextPrompt || "";
                    const persistentContextPrompt =
                        computedPersistentContextPrompt ??
                        threadBootstrap?.persistentContextPrompt ??
                        null;
                    const dynamicContextPrompt =
                        computedDynamicContextPrompt ??
                        threadBootstrap?.dynamicContextPrompt ??
                        null;
                    const taskQueue = Array.isArray((state as any).taskQueue) ? (state as any).taskQueue : [];
                    const currentTaskId = typeof (state as any).currentTaskId === "string" ? (state as any).currentTaskId : "";
                    const taskContextBlock = [
                        "## PLAN & TASK QUEUE",
                        `Current task id: ${currentTaskId || "(none)"}`,
                        `Task queue: ${JSON.stringify(taskQueue, null, 2)}`,
                        "Use write_todos to create or update the task queue when the mission requires multiple steps.",
                        "IMPORTANT: Do NOT call write_todos repeatedly with the same payload. Call it once, then proceed with actual work.",
                    ].join("\n");

                    const workspaceAccessBlock = [
                        "## WORKSPACE ACCESS",
                        `- Working folder: ${rootDir}`,
                        `- Agent graph id for this thread: ${run.graphId.toString()}`,
                        "- For kletron_get_graph / kletron_update_graph targeting **this** conversation's configuration, use that exact 24-character hex id (copy verbatim). Do not invent UUIDs or shorten the string.",
                        "- Use available tools to read and write inside this workspace.",
                        "- Do not ask for generic workspace access when the tools already provide it.",
                    ].join("\n");

                    const enhancedSystemPrompt = [
                        baseSystemPrompt,
                        runContextPrompt,
                        workDateGroundingBlock,
                        workspaceAccessBlock,
                        persistentContextPrompt,
                        dynamicContextPrompt,
                        conversationSummaryPrompt,
                        taskContextBlock,
                        webHintBlock ? webHintBlock.trim() : null,
                        sentryHintBlock ? sentryHintBlock.trim() : null,
                        fastSuffix ? fastSuffix.trim() : null,
                    ]
                        .filter((value): value is string => Boolean(value && value.trim().length > 0))
                        .join("\n\n");

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
                    // Single execution path: every node is a ReAct agent. The former `router`
                    // and `delegate` node kinds are gone — delegation is now dynamic, through
                    // the `task` tool (see subagentRegistry / subagentRunner).
                    {
                        // Build extraMessages from prior conversation history for multi-turn
                        const priorHistory = state.conversationHistory ?? [];
                        const historyWindow = recentHistoryForReplay;
                        
                        // Prevent sending consecutive identical user messages.
                        // reactAgentRunner will append `opts.userPrompt` (which evaluates to state.mission).
                        // If the last history event is exactly this mission prompt, remove it from passed history.
                        const validHistory = [...historyWindow];
                        if (validHistory.length > 0) {
                            const lastEvent = validHistory[validHistory.length - 1];
                            const missionText = typeof state.mission === "string" ? state.mission : "";
                            if (lastEvent.kind === "user" && lastEvent.content === missionText) {
                                validHistory.pop();
                            }
                        }

                        // Convert to BaseMessages, filtering out system messages (system prompt is already injected)
                        const convertedHistory = validHistory.length > 0
                            ? convertConversationHistoryToMessages(validHistory).filter(m => m.getType() !== "system")
                            : [];
                        const extraMessages = convertedHistory.length > 0 ? convertedHistory : undefined;
                        
                        // Diagnostic logging for multi-turn debugging
                        if (priorHistory.length > 0) {
                            const msgSummary = (convertedHistory || []).map(m => {
                                const type = m.getType();
                                const content = typeof m.content === "string" ? m.content.slice(0, 60) : JSON.stringify(m.content).slice(0, 60);
                                const tc = (m as any).tool_calls;
                                return `${type}(${content}${tc?.length ? `, tool_calls=${tc.length}` : ''})`;
                            });
                            console.log(`[AgentGraphExecutor] Multi-turn extraMessages: ${convertedHistory.length} messages from ${priorHistory.length} history events`);
                            console.log(`[AgentGraphExecutor] extraMessages summary: ${msgSummary.join(' → ')}`);
                            console.log(`[AgentGraphExecutor] userPrompt will be: "${userPrompt.slice(0, 80)}"`);
                        }

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
                            recursionLimit: reactRecursionLimit,
                            llmSelection: opts?.llmSelectionOverride,
                            upstreamPrepMs: performance.now() - runWallClockT0,
                            clientSentAtMs: opts?.clientSentAtMs,
                            serverRequestReceivedAtMs: opts?.serverRequestReceivedAtMs,
                            runId,
                            extraMessages: shouldResume ? undefined : extraMessages,
                            onMessage: handleStreamingMessage,
                            // Forward text deltas for progressive streaming
                            onTextDelta: opts?.onTextDelta,
                            onReasoningDelta: opts?.onReasoningDelta,
                            abortSignal: abortController.signal,
                            getAbortReason: () => abortReason,
                            shouldAbort: checkAbortReason,
                            // Pin the workspace root so MCP tools always
                            // operate against the desktop-selected folder.
                            workspaceRoot: rootDir,
                            // Checkpoint / persistence
                            checkpointer,
                            threadId,
                            interruptBeforeTools,
                            resumeFromCheckpoint: shouldResume,
                            onTokenUsage: async (usage, model) => {
                                // Log individual usage to MongoDB and accumulate in-memory
                                await tokenUsageService.logUsage({
                                    timestamp: new Date(),
                                    provider: (opts?.llmSelectionOverride?.provider ?? "default") as any,
                                    model,
                                    usage,
                                    ...(workspaceObjectId ? { workspaceId: workspaceObjectId } : {}),
                                    runId: new ObjectId(runId),
                                    nodeId: node.id,
                                    callType: "react_agent",
                                });
                            },
                        });
                        emitLlmKpi(result.kpi);

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
                        // Per-tool telemetry: count, mean ms, errors.
                        if (toolCallSummary.size > 0) {
                            (timelineEntry as any).toolCallsSummary = Array.from(
                                toolCallSummary.entries()
                            )
                                .map(([toolName, stats]) => ({
                                    name: toolName,
                                    count: stats.count,
                                    errors: stats.errors,
                                    meanMs: Math.round(
                                        stats.totalMs / Math.max(1, stats.count)
                                    ),
                                }))
                                .sort((a, b) => b.count - a.count);
                        }
                    }
                    await emitUpdate();
                } catch (err: any) {
                    if (err instanceof ToolApprovalPauseError || err?.name === "ToolApprovalPauseError") {
                        const { summary: runTokenUsage } = tokenUsageService.finalizeRunTracking(runId);
                        await agentGraphRunService.updateRunTokenUsage(runId, runTokenUsage);
                        await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "RUNNING");
                        await agentGraphRunService.updateRunStatus(runId, "PAUSED", {
                            endedAt: new Date(),
                            error: `Awaiting approval for ${err.toolName} (${err.approvalId}).`,
                        } as any);

                        timeline[0].status = "running";
                        timeline[0].summary = `Paused — awaiting approval for ${err.toolName}`;
                        timeline[0].endedAt = new Date().toISOString();
                        await flushUpdate();

                        if (timelineEntry) {
                            timelineEntry.status = "running";
                            timelineEntry.summary = `Paused — awaiting approval for ${err.toolName}`;
                            timelineEntry.endedAt = new Date().toISOString();
                        }
                        await emitUpdate();

                        return {
                            sessionId: runId,
                            timeline: globalTimeline,
                            conclusion: "Run paused (tool approval required).",
                            outputs: createPlaceholderOutputs({
                                mission: typeof state.mission === "string" ? state.mission : "",
                                report: `Awaiting approval for tool ${err.toolName}.`,
                                meta: {
                                    runId,
                                    graphId: run.graphId.toString(),
                                    state: cloneValue(state),
                                    interrupted: true,
                                    approvalPending: true,
                                    toolName: err.toolName,
                                    approvalId: err.approvalId,
                                },
                            }),
                            eventStream: globalEventStream,
                        };
                    }
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

                    let errorMessage = err?.message ?? String(err);
                    if (errorMessage.includes("fetch failed") || errorMessage.includes("Failed to fetch")) {
                        errorMessage = "Failed to connect to the local LLM provider. Please ensure Ollama, LM Studio, or vLLM is running and configured correctly.";
                    }

                    await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "FAILED");
                    await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                        endedAt: new Date(),
                        error: errorMessage,
                    } as any);

                    timeline[0].status = "error";
                    timeline[0].summary = `Failed: ${errorMessage}`;
                    timeline[0].endedAt = new Date().toISOString();
                    await flushUpdate();

                    if (timelineEntry) {
                        timelineEntry.status = "error";
                        timelineEntry.summary = `Failed: ${errorMessage}`;
                        timelineEntry.endedAt = new Date().toISOString();
                    }
                    // Emit an error event so the UI can display the failure message
                    const errorEvent: AgentEvent = {
                        id: nextGlobalEventId(),
                        phaseId: nodeId,
                        phaseLabel: node.label ?? nodeId,
                        kind: "assistant",
                        role: "assistant",
                        content: `**Error:** ${errorMessage}`,
                        timestamp: new Date().toISOString(),
                        isError: true,
                    };
                    eventStream.push(errorEvent);
                    globalEventStream.push(errorEvent);
                    state.conversationHistory?.push(errorEvent);
                    await emitUpdate();

                    cleanupCheckpoints();
                    return {
                        sessionId: runId,
                        timeline: globalTimeline,
                        conclusion: "Run failed.",
                        outputs: createPlaceholderOutputs({
                            mission: typeof state.mission === "string" ? state.mission : "",
                            report: `ERROR: ${errorMessage}`,
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
            cleanupCheckpoints();
            return successResult;
            } finally {
                if (diskSkillRegistryOverlay) {
                    await skillRegistry.reload().catch((err) =>
                        console.warn(
                            "[AgentGraph] skillRegistry.reload after .kletron/skills:",
                            (err as Error)?.message ?? err
                        )
                    );
                }
            }
            },
            { userId: opts?.workspaceContextUserId ?? workspace.ownerId, runId }
        );
    }
}

export const agentGraphExecutor = new AgentGraphExecutor();
