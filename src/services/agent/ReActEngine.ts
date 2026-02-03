
import path from "node:path";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { streamReactAgentMessages } from "../../reactAgentRunner";
import { allMcpTools } from "../../tools/mcpTools";
import { ConversationService } from "./ConversationService";
import { SafeEditGate } from "./SafeEditGate";
import { AgentEvent } from "../../types";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { McpClient } from "../../mcp/client";
import { getConfig } from "../../config";
import type { LlmProviderType } from "@/src/schemas/llmConfig.schema";

// Get the ConversationService instance (in a real app, use dependency injection)
const conversationService = new ConversationService();
const safeEditGate = SafeEditGate.getInstance();

export class ReActEngine {
    private static instance: ReActEngine;

    private constructor() { }

    static getInstance(): ReActEngine {
        if (!ReActEngine.instance) {
            ReActEngine.instance = new ReActEngine();
        }
        return ReActEngine.instance;
    }

    // Wrap the write_file tool to intercept and propose edits
    private getSafeTools(conversationId: string) {
        const safeWriteFile = tool(
            async (input: { filePath: string; content: string; repoPath?: string; overwrite?: boolean }) => {
                // Propose the edit instead of executing
                const edit = safeEditGate.proposeEdit(conversationId, "write_file", input, `Write to ${input.filePath}`);

                return `Edit proposed (ID: ${edit.id}) for ${input.filePath}. The edit has been queued for user review. Continue with your task - the user will review all proposed edits together at the end.`;
            },
            {
                name: "write_file",
                description: "Propose writing a file. The user must approve this action.",
                schema: z.object({
                    filePath: z.string(),
                    content: z.string(),
                    repoPath: z.string().optional(),
                    overwrite: z.boolean().optional(),
                    createDirs: z.boolean().optional()
                })
            }
        );
        const safeStrReplace = tool(
            async (input: { repoPath?: string; path?: string; filePath?: string; action?: string; operation?: string; startLine?: number; endLine?: number; maxBytes?: number }) => {
                const edit = safeEditGate.proposeEdit(conversationId, "str_replace_editor", input, `Edit (str_replace) ${input.filePath || input.path}`);
                return `Edit proposed (ID: ${edit.id}) for ${input.filePath || input.path}. The edit has been queued for user review. Continue with your task.`;
            },
            {
                name: "str_replace_editor",
                description: "Propose editing a file via string replacement. The user must approve this action.",
                schema: z.object({
                    repoPath: z.string().optional(),
                    path: z.string().optional(),
                    filePath: z.string().optional(),
                    action: z.string().optional(),
                    operation: z.string().optional(),
                    startLine: z.number().int().positive().optional(),
                    endLine: z.number().int().positive().optional(),
                    maxBytes: z.number().int().positive().optional(),
                })
            }
        );

        const safeToolNames = ["write_file", "str_replace_editor"];
        const tools = allMcpTools.filter(t => !safeToolNames.includes(t.name)).concat([safeWriteFile, safeStrReplace]);
        return tools;
    }

    async chat(conversationId: string, userMessage: string, onUpdate?: (event: AgentEvent) => void, llmSelection?: { provider: LlmProviderType; model?: string }): Promise<string> {
        // 1. Load conversation history
        const conversation = await conversationService.get(conversationId);
        if (!conversation) throw new Error("Conversation not found");

        // 2. Prepare messages for the agent
        // We map stored AgentEvents back to BaseMessages to maintain context
        const previousMessages: BaseMessage[] = conversation.messages.map(m => {
            if (m.kind === "user") return new HumanMessage(m.content);
            if (m.kind === "system") return new SystemMessage(m.content);
            if (m.kind === "assistant") {
                // If it had tool calls, we should reconstruct that structure if possible
                // For simplicity in this sync, we'll treat text history as text
                return new HumanMessage(m.content); // Fallback
            }
            if (m.kind === "tool") {
                // Return generic human message for tool context as fallback
                return new HumanMessage(`Tool Output (${m.toolName}): ${m.content}`);
            }
            return new HumanMessage(m.content);
        });

        // 3. Append new user message to history
        const newUserEvent: AgentEvent = {
            id: `ev-${Date.now()}`,
            phaseId: "chat",
            kind: "user",
            role: "user",
            content: userMessage,
            timestamp: new Date().toISOString()
        };
        await conversationService.appendEvent(conversationId, newUserEvent);
        if (onUpdate) onUpdate(newUserEvent);

        // 4. Run the agent
        const tools = this.getSafeTools(conversationId);
        const systemPrompt = `You are an expert developer assistant embedded in Numezis Code.
You can analyze code, browse files, and propose edits.

WORKFLOW:
- When you use 'write_file' or 'str_replace_editor', the edit is queued for user review.
- You should CONTINUE working after proposing edits - do NOT stop to wait for approval.
- The user will review all proposed edits together at the end (like Cursor).
- Complete your entire task, proposing all necessary file changes.

IMPORTANT:
- Do NOT ask about approving individual edits - just keep working.
- The execute_bash tool only supports: find, grep, rg, ls, cat (safe emulation). Complex shell commands won't work.
- For file verification, use read_file or list_dir instead of bash commands.`;

        let finalResponse = "";

        try {
            // Helper to process and save a message
            const processMessage = async (msg: BaseMessage) => {
                const type = msg.getType();
                const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

                // Skip user/system messages we already know
                if (type === "human" && content === userMessage) return;
                if (type === "system") return;

                if (type === "ai") {
                    const aiMsg = msg as any;
                    const toolCalls = aiMsg.tool_calls || [];

                    // 1. Handle Thoughts (Text content)
                    if (content && content.trim()) {
                        const event: AgentEvent = {
                            id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            phaseId: "chat",
                            kind: "assistant",
                            role: "assistant",
                            content: content,
                            thoughts: toolCalls.length > 0 ? [content] : undefined,
                            timestamp: new Date().toISOString()
                        };
                        await conversationService.appendEvent(conversationId, event);
                        if (onUpdate) onUpdate(event);
                    }

                    // 2. Handle Tool Calls
                    for (const tc of toolCalls) {
                        const event: AgentEvent = {
                            id: `ev-${Date.now()}-${tc.id}`,
                            phaseId: "chat",
                            kind: "assistant",
                            role: "assistant",
                            content: "",
                            toolName: tc.name,
                            toolArgs: JSON.stringify(tc.args),
                            toolCallId: tc.id,
                            timestamp: new Date().toISOString()
                        };
                        await conversationService.appendEvent(conversationId, event);
                        if (onUpdate) onUpdate(event);
                    }
                } else if (type === "tool") {
                    const toolMsg = msg as any;
                    const event: AgentEvent = {
                        id: `ev-${Date.now()}-${toolMsg.tool_call_id || Math.random()}`,
                        phaseId: "chat",
                        kind: "tool",
                        role: "tool",
                        content: content,
                        toolName: toolMsg.name || "unknown",
                        toolOutput: content,
                        toolCallId: toolMsg.tool_call_id,
                        timestamp: new Date().toISOString()
                    };
                    await conversationService.appendEvent(conversationId, event);
                    if (onUpdate) onUpdate(event);
                }
            };

            await streamReactAgentMessages({
                name: "AgentDeveloper",
                systemPrompt,
                userPrompt: userMessage,
                tools,
                llmSelection,
                extraMessages: previousMessages.filter(m => m.getType() !== "system"),
                onMessage: async (msg: BaseMessage) => {
                    await processMessage(msg);
                }
            });

            finalResponse = "Agent execution completed.";

        } catch (error: any) {
            console.error("Agent error:", error);
            const errorEvent: AgentEvent = {
                id: `ev-${Date.now()}-err`,
                phaseId: "chat",
                kind: "assistant",
                role: "assistant",
                content: "Sorry, I encountered an error: " + error.message,
                timestamp: new Date().toISOString()
            };
            await conversationService.appendEvent(conversationId, errorEvent);
            if (onUpdate) onUpdate(errorEvent);
            finalResponse = "Error: " + error.message;
        }

        return finalResponse;
    }

    async executeApprovedEdit(editId: string) {
        const edit = safeEditGate.approveEdit(editId);
        if (!edit) throw new Error("Edit not found or not in pending state");

        // Get the configured working folder for path resolution
        const config = await getConfig();
        const workingFolder = config.workingFolder;

        // Helper to resolve relative paths against the working folder
        const resolveFilePath = (filePath: string): string => {
            if (!filePath) return filePath;
            if (path.isAbsolute(filePath)) return filePath;
            return path.resolve(workingFolder, filePath);
        };

        if (edit.toolName === "write_file") {
            const client = await McpClient.getInstance();
            // Resolve filePath and force overwrite true since user approved
            const args = {
                ...edit.args,
                filePath: resolveFilePath(edit.args.filePath as string),
                overwrite: true
            };
            await client.callTool("write_file", args);
            return true;
        }
        if (edit.toolName === "str_replace_editor") {
            const client = await McpClient.getInstance();
            // Resolve path/filePath for str_replace_editor
            const args = {
                ...edit.args,
                filePath: edit.args.filePath ? resolveFilePath(edit.args.filePath as string) : undefined,
                path: edit.args.path ? resolveFilePath(edit.args.path as string) : undefined,
            };
            await client.callTool("str_replace_editor", args);
            return true;
        }
        return false;
    }
}
