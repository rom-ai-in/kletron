import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";
import { getDb } from "../lib/db";
import { runWorkflow } from "@kletron/agent-core/workflows";
import { AgentWorkflowAbortError } from "@kletron/agent-core/reactAgentRunner";
import { agentGraphService } from "./agentGraphService";
import { agentGraphRunService } from "./agentGraphRunService";
import { agentGraphExecutor } from "./agentGraphExecutor";
import { getGraphNodeOrder, buildInitialState } from "./agentGraphRuntime";
import { getWorkspaceByIdUnsafe, listAllWorkspaces } from "./workspaceService";
import type {
    AutomationDefinition,
    AutomationFilter,
    AutomationStageConfig,
    AutomationErrorKind,
} from "@kletron/shared/automationTypes";
import type { AgentEvent, AgentWorkflowResult, AgentWorkflowAbortReason } from "@kletron/shared/types";
import type { AgentGraphNodeStatus, AutomationStageRunResult } from "./agentGraphTypes";
import { computeNextRun } from "@kletron/shared/cronUtils";

const COLLECTION_NAME = "audit_chains"; // Legacy collection name - kept for backward compatibility

/** Default per-stage timeout: 10 minutes. Override per-stage via `stage.timeoutMs`. */
const DEFAULT_STAGE_TIMEOUT_MS = 600_000;

/**
 * Classify a stage error into a structured category for diagnostics and UI.
 */
function classifyStageError(error: unknown): AutomationErrorKind {
    if (error instanceof AgentWorkflowAbortError && (error as any).reason === "TIMEOUT") return "LLM_TIMEOUT";
    const msg = error instanceof Error ? error.message : String(error ?? "");
    if (/rate.?limit|429|503|502|gateway.?timeout|ECONNRESET|ETIMEDOUT/i.test(msg)) return "LLM_ERROR";
    if (/tool.*blocked|outside.*configured.*directories|not accessible/i.test(msg)) return "TOOL_BLOCKED";
    return "UNKNOWN";
}

function extractRawReportText(rawReport: unknown): string {
    if (typeof rawReport === "string") return rawReport;
    if (rawReport && typeof rawReport === "object") {
        const record = rawReport as Record<string, unknown>;
        const markdown = typeof record.markdown === "string" ? record.markdown : "";
        const summary = typeof record.summary === "string" ? record.summary : "";
        if (markdown) return markdown;
        if (summary) return summary;
        return JSON.stringify(record);
    }
    return "";
}

const toObjectId = (id?: string): ObjectId | undefined => {
    if (!id) return undefined;
    if (!ObjectId.isValid(id)) return undefined;
    return new ObjectId(id);
};

/**
 * AutomationExecutor — manages automation configurations and runs each
 * execution as a single agent thread (`agent_graph_runs`). Multi-stage
 * automations append per-stage prompts and outputs as conversation turns
 * in the main thread; stages 1..N execute as hidden sub-runs whose
 * conclusions are folded into the main thread's `state.conversationHistory`.
 *
 * The legacy `audit_runs` and `audit_sessions` collections are no longer
 * read or written by this service.
 */
export class AutomationExecutor {
    /**
     * Create a new automation (configuration only; runtime state lives on
     * the agent threads created per execution).
     */
    async createAutomation(
        config: Omit<AutomationDefinition, "_id" | "createdAt">
    ): Promise<string> {
        const db = await getDb();

        const workspaceId =
            typeof (config as any).workspaceId === "string"
                ? toObjectId((config as any).workspaceId)
                : (config as any).workspaceId;

        const triggerType = config.triggerType || "manual";

        let webhookConfig = config.webhookConfig;
        if (triggerType === "webhook" && !webhookConfig?.secret) {
            webhookConfig = {
                ...webhookConfig,
                secret: randomBytes(32).toString("hex"),
            };
        }

        let gitEventConfig = config.gitEventConfig;
        if (triggerType === "git_event" && gitEventConfig && !gitEventConfig.secret) {
            gitEventConfig = {
                ...gitEventConfig,
                secret: randomBytes(32).toString("hex"),
            };
        }

        let schedule = config.schedule;
        if (triggerType === "schedule" && schedule?.enabled && schedule.cron && schedule.timezone) {
            const nextRun = computeNextRun(schedule.cron, schedule.timezone);
            schedule = {
                ...schedule,
                executionCount: 0,
                nextScheduledAt: nextRun ?? undefined,
            };
        }

        const chain: AutomationDefinition = {
            ...config,
            ...(workspaceId ? { workspaceId } : {}),
            triggerType,
            ...(webhookConfig ? { webhookConfig } : {}),
            ...(gitEventConfig ? { gitEventConfig } : {}),
            ...(schedule ? { schedule } : {}),
            createdAt: new Date(),
        };

        const result = await db.collection(COLLECTION_NAME).insertOne(chain);
        return result.insertedId.toString();
    }

    /**
     * Get automation by ID
     */
    async getAutomation(chainId: string, workspaceId?: string): Promise<AutomationDefinition | null> {
        const db = await getDb();
        const query: Record<string, unknown> = { _id: new ObjectId(chainId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return null;
            query.$or = [
                { workspaceId: workspaceObjectId },
                { workspaceId: { $exists: false } },
            ];
        }
        const chain = await db.collection(COLLECTION_NAME).findOne(query);
        return chain as AutomationDefinition | null;
    }

    /**
     * List automations with optional filtering
     */
    async listAutomations(filter?: AutomationFilter): Promise<AutomationDefinition[]> {
        const db = await getDb();
        const query: any = {};

        if (filter?.workspaceId) {
            const workspaceObjectId = toObjectId(filter.workspaceId);
            if (!workspaceObjectId) return [];
            query.$and = [
                ...(query.$and || []),
                { $or: [
                    { workspaceId: workspaceObjectId },
                    { workspaceId: { $exists: false } },
                ] },
            ];
        }

        // filter.status is deprecated; status no longer lives on the config doc.

        if (filter?.search) {
            query.$and = [
                ...(query.$and || []),
                { $or: [
                    { name: { $regex: filter.search, $options: "i" } },
                    { description: { $regex: filter.search, $options: "i" } },
                ] },
            ];
        }

        if (filter?.scheduledOnly) query["schedule.enabled"] = true;
        if (filter?.triggerType) query.triggerType = filter.triggerType;

        const chains = await db
            .collection(COLLECTION_NAME)
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        return chains as AutomationDefinition[];
    }

    /**
     * Update automation configuration
     */
    async updateAutomation(
        chainId: string,
        updates: Partial<AutomationDefinition>,
        workspaceId?: string
    ): Promise<void> {
        const db = await getDb();
        const { _id: _, workspaceId: __, ...updateData } = updates as any;

        const triggerType = updateData.triggerType || "manual";

        if (triggerType === "webhook" && !updateData.webhookConfig?.secret) {
            const existing = await this.getAutomation(chainId, workspaceId);
            if (!existing?.webhookConfig?.secret) {
                updateData.webhookConfig = {
                    ...updateData.webhookConfig,
                    secret: randomBytes(32).toString("hex"),
                };
            }
        }

        if (triggerType === "git_event" && updateData.gitEventConfig && !updateData.gitEventConfig.secret) {
            const existing = await this.getAutomation(chainId, workspaceId);
            if (!existing?.gitEventConfig?.secret) {
                updateData.gitEventConfig = {
                    ...updateData.gitEventConfig,
                    secret: randomBytes(32).toString("hex"),
                };
            }
        }

        // `$set` replaces the whole schedule subdocument, so run-history fields must be
        // carried over on every schedule write — including a plain enable/disable
        // toggle, which would otherwise reset the execution count to nothing.
        if (triggerType === "schedule" && updateData.schedule) {
            const existing = await this.getAutomation(chainId, workspaceId);
            const canComputeNextRun =
                updateData.schedule.enabled && updateData.schedule.cron && updateData.schedule.timezone;
            const nextRun = canComputeNextRun
                ? computeNextRun(updateData.schedule.cron, updateData.schedule.timezone)
                : null;
            updateData.schedule = {
                ...updateData.schedule,
                executionCount: existing?.schedule?.executionCount ?? 0,
                lastScheduledAt: existing?.schedule?.lastScheduledAt ?? undefined,
                // Paused schedules keep no next run; re-enabling recomputes it.
                nextScheduledAt: nextRun ?? undefined,
            };
        }

        const query: Record<string, unknown> = { _id: new ObjectId(chainId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return;
            query.workspaceId = workspaceObjectId;
        }

        await db.collection(COLLECTION_NAME).updateOne(query, { $set: updateData });
    }

    /**
     * Delete an automation
     */
    async deleteAutomation(chainId: string, workspaceId?: string): Promise<void> {
        const db = await getDb();
        const query: Record<string, unknown> = { _id: new ObjectId(chainId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return;
            query.workspaceId = workspaceObjectId;
        }
        await db.collection(COLLECTION_NAME).deleteOne(query);
    }

    /**
     * Build context from previous stage results for use in subsequent stage prompts.
     */
    private buildStageContext(
        stage: AutomationStageConfig,
        previousResults: AutomationStageRunResult[]
    ): Record<string, unknown> | null {
        if (!stage.contextFromPreviousStages || stage.contextFromPreviousStages.length === 0) {
            return null;
        }
        const context: Record<string, unknown> = {};
        for (const selector of stage.contextFromPreviousStages) {
            const [stageId] = selector.split(".");
            const prev = previousResults.find((r) => r.stageId === stageId);
            if (!prev) continue;
            if (prev.rawOutput) {
                context[`${stageId}.output`] = prev.rawOutput;
            }
        }
        return Object.keys(context).length > 0 ? context : null;
    }

    /**
     * Render the user prompt that drives a single stage.
     */
    private buildUserPrompt(
        stage: AutomationStageConfig,
        context: Record<string, unknown> | null,
        workspaceRootPath?: string
    ): string {
        const basePrompt = stage.prompt?.trim();
        if (!basePrompt) {
            throw new Error(`Stage ${stage.id} has an empty prompt`);
        }

        const parts: string[] = [];

        if (workspaceRootPath) {
            parts.push("## TARGET WORKSPACE");
            parts.push(`You are working on the project located at: ${workspaceRootPath}`);
            parts.push(`All file paths are relative to this root directory.`);
            parts.push(`Do NOT search or modify files outside of: ${workspaceRootPath}`);
            parts.push("");
        }

        parts.push("## TASK");
        parts.push(basePrompt);

        if (context) {
            parts.push("");
            parts.push("## CONTEXT FROM PREVIOUS STAGES");
            parts.push(JSON.stringify(context, null, 2));
        }

        return parts.join("\n");
    }

    /**
     * Resolve workspace root path so prompts can target the right directory.
     */
    private async resolveWorkspaceRootPath(workspaceId?: string): Promise<string | undefined> {
        try {
            const workspace = workspaceId
                ? await getWorkspaceByIdUnsafe(workspaceId)
                : (await listAllWorkspaces())[0];
            return workspace?.rootPath;
        } catch {
            return undefined;
        }
    }

    /**
     * Append a synthetic event to the main automation thread's
     * `state.conversationHistory` and persist it.
     */
    private async appendMainThreadEvent(mainRunId: string, event: AgentEvent): Promise<void> {
        const run = await agentGraphRunService.getRun(mainRunId);
        if (!run) return;
        const state = run.state ?? { nodes: {} };
        const history = state.conversationHistory ?? [];
        history.push(event);
        await agentGraphRunService.updateRunState(mainRunId, {
            ...state,
            conversationHistory: history,
        });
    }

    /**
     * Run an automation as a single agent thread.
     *
     * Behaviour:
     * - One agent_graph_run is created (the "main thread") tied to the
     *   automation via `automationId` and `stageIndex: 0`. Its initial graph
     *   is `stages[0].graphId`. The thread is what the user sees in /app/agent.
     * - Stage 0 executes natively in that thread via
     *   `agentGraphExecutor.executeRunStreaming` so the conversationHistory
     *   is populated as in a normal chat.
     * - Stages 1..N execute as hidden sub-runs (own agent_graph_run docs with
     *   `parentRunId = mainRunId, stageIndex: i, source: "automation_substage"`)
     *   and their conclusions are appended to the main thread as a synthetic
     *   user/assistant turn pair.
     */
    async runAutomationAsThread(
        automationId: string,
        workspaceId?: string,
    ): Promise<{ threadId: string }> {
        const automation = await this.getAutomation(automationId, workspaceId);
        if (!automation) {
            throw new Error(`Automation ${automationId} not found`);
        }
        if (!automation.stages?.length) {
            throw new Error(`Automation ${automationId} has no stages`);
        }
        const missingPrompts = automation.stages
            .map((stage, index) => (stage.prompt && stage.prompt.trim().length > 0
                ? null
                : { stageId: stage.id, stageName: stage.name, index }))
            .filter(Boolean);
        if (missingPrompts.length > 0) {
            throw new Error(`Automation ${automationId} has stages with missing prompts: ${missingPrompts.map((p) => (p as any).stageName).join(", ")}`);
        }

        const resolvedWorkspaceId = workspaceId ?? automation.workspaceId?.toString();
        const workspaceRootPath = await this.resolveWorkspaceRootPath(resolvedWorkspaceId);

        const firstStage = automation.stages[0];
        const firstGraph = await agentGraphService.resolveGraphForStage(firstStage.graphId);
        if (!firstGraph?._id) {
            throw new Error(`Graph ${firstStage.graphId} not found for stage 0`);
        }
        const resolvedGraphId = firstGraph._id.toString();

        // ── Create the main thread ──
        const dateStr = new Date().toISOString().slice(0, 16).replace("T", " ");
        const title = `${automation.name} · ${dateStr}`;
        const mainRunId = await agentGraphRunService.createRun(
            resolvedGraphId,
            resolvedWorkspaceId,
            "automation",
            {
                automationId,
                stageIndex: 0,
                title,
            }
        );

        // Fire-and-forget execution; caller redirects to /app/agent?sessionId=mainRunId
        void this.executeStagesInThread(mainRunId, automation, workspaceRootPath, resolvedWorkspaceId).catch((error) => {
            console.error(`[AutomationExecutor] Automation ${automationId} thread ${mainRunId} crashed:`, error);
        });

        return { threadId: mainRunId };
    }

    /**
     * Internal execution loop. Runs all stages and updates the main thread
     * with results.
     */
    private async executeStagesInThread(
        mainRunId: string,
        automation: AutomationDefinition,
        workspaceRootPath: string | undefined,
        workspaceId: string | undefined,
    ): Promise<void> {
        const startTime = Date.now();
        const stageResults: AutomationStageRunResult[] = [];

        // Seed the main thread state with the first stage prompt as the mission.
        const firstStage = automation.stages[0];
        const firstGraph = await agentGraphService.resolveGraphForStage(firstStage.graphId);
        if (!firstGraph?._id) {
            await agentGraphRunService.updateRunStatus(mainRunId, "FAILED", {
                endedAt: new Date(),
                error: `Graph ${firstStage.graphId} not found`,
            } as any);
            return;
        }

        const firstContext = this.buildStageContext(firstStage, []);
        const firstPrompt = this.buildUserPrompt(firstStage, firstContext, workspaceRootPath);

        const initialNodeStatuses: Record<string, AgentGraphNodeStatus> = {};
        for (const node of firstGraph.nodes) {
            initialNodeStatuses[node.id] = "PENDING";
        }
        const nodeOrder = getGraphNodeOrder(firstGraph);
        const initialState = buildInitialState(firstGraph, firstPrompt);
        // Seed stage 0 immediately so the thread is not blank while the
        // server-side automation run is still warming up.
        initialState.conversationHistory = [
            {
                id: `automation-stage-0-user-${Date.now()}`,
                phaseId: "automation_stage_0",
                phaseLabel: `Stage 1: ${firstStage.name}`,
                kind: "user",
                role: "user",
                content: firstPrompt,
                timestamp: new Date().toISOString(),
                metadata: {
                    source: "automation",
                    stageIndex: 0,
                    stageId: firstStage.id,
                    stageName: firstStage.name,
                    stageTotal: automation.stages.length,
                },
            },
        ];

        await agentGraphRunService.updateRunStatus(mainRunId, "RUNNING", {
            nodeOrder,
            nodeStatuses: initialNodeStatuses,
            state: initialState,
            conversationTurns: 1,
        } as any);

        // ── Stage 0: run natively in the main thread ──
        let stage0Result: AutomationStageRunResult;
        try {
            const stageStarted = Date.now();
            const stageTimeoutMs = firstStage.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
            const deadline = stageStarted + stageTimeoutMs;
            const shouldAbort = async (): Promise<AgentWorkflowAbortReason | null> => {
                if (Date.now() >= deadline) return "TIMEOUT";
                const fresh = await agentGraphRunService.getRun(mainRunId);
                if (fresh?.status === "PAUSED") return "PAUSED";
                if (fresh?.status === "CANCELLED") return "CANCELLED";
                return null;
            };
            const result = await agentGraphExecutor.executeRunStreaming(mainRunId, {
                shouldAbort,
                ...(firstStage.llmProvider
                    ? {
                        llmSelectionOverride: {
                            provider: firstStage.llmProvider,
                            model: firstStage.llmModel,
                        },
                    }
                    : {}),
            } as any);
            stage0Result = this.summariseStageResult({
                stage: firstStage,
                stageIndex: 0,
                result,
                duration: Date.now() - stageStarted,
                success: true,
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            stage0Result = {
                stageId: firstStage.id,
                stageName: firstStage.name,
                stageIndex: 0,
                success: false,
                error: errorMsg,
                errorKind: classifyStageError(error),
                duration: Date.now() - startTime,
            };
        }
        stageResults.push(stage0Result);

        // ── Stages 1..N: hidden sub-runs whose conclusions are appended ──
        for (let i = 1; i < automation.stages.length; i++) {
            const stage = automation.stages[i];
            const stageStarted = Date.now();
            const context = this.buildStageContext(stage, stageResults);
            const userPrompt = this.buildUserPrompt(stage, context, workspaceRootPath);
            const stageTimeoutMs = stage.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;

            // Append a synthetic user message describing the upcoming stage.
            const stageUserId = `automation-stage-${i}-user-${Date.now()}`;
            const userEvent: AgentEvent = {
                id: stageUserId,
                phaseId: `automation_stage_${i}`,
                phaseLabel: `Stage ${i + 1}: ${stage.name}`,
                kind: "user",
                role: "user",
                content: userPrompt,
                timestamp: new Date().toISOString(),
                metadata: {
                    source: "automation",
                    stageIndex: i,
                    stageId: stage.id,
                    stageName: stage.name,
                    stageTotal: automation.stages.length,
                },
            };
            await this.appendMainThreadEvent(mainRunId, userEvent);

            // Track sub-run id so the UI can offer "view full stage trace".
            let subRunId: string | undefined;
            const deadline = stageStarted + stageTimeoutMs;
            const shouldAbort = async (): Promise<AgentWorkflowAbortReason | null> => {
                if (Date.now() >= deadline) return "TIMEOUT";
                const fresh = await agentGraphRunService.getRun(mainRunId);
                if (fresh?.status === "PAUSED") return "PAUSED";
                if (fresh?.status === "CANCELLED") return "CANCELLED";
                return null;
            };

            let stageResult: AutomationStageRunResult;
            try {
                const result = await runWorkflow(userPrompt, stage.graphId, {
                    workspaceId,
                    source: "automation_substage",
                    automationId: automation._id?.toString(),
                    parentRunId: mainRunId,
                    stageIndex: i,
                    title: `${automation.name} · Stage ${i + 1}: ${stage.name}`,
                    llmSelection: stage.llmProvider
                        ? { provider: stage.llmProvider, model: stage.llmModel }
                        : undefined,
                    shouldAbort,
                    onRunCreated: (id) => {
                        subRunId = id;
                    },
                });
                stageResult = this.summariseStageResult({
                    stage,
                    stageIndex: i,
                    result,
                    duration: Date.now() - stageStarted,
                    success: true,
                    subRunId,
                });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                stageResult = {
                    stageId: stage.id,
                    stageName: stage.name,
                    stageIndex: i,
                    subRunId,
                    success: false,
                    error: errorMsg,
                    errorKind: classifyStageError(error),
                    duration: Date.now() - stageStarted,
                };
            }
            stageResults.push(stageResult);

            // Append the stage's conclusion as an assistant message.
            const assistantEvent: AgentEvent = {
                id: `automation-stage-${i}-assistant-${Date.now()}`,
                phaseId: `automation_stage_${i}`,
                phaseLabel: `Stage ${i + 1}: ${stage.name}`,
                kind: "assistant",
                role: "assistant",
                content: stageResult.success
                    ? (stageResult.rawOutput || "*Stage completed without output.*")
                    : `**Stage failed:** ${stageResult.error ?? "Unknown error"}`,
                timestamp: new Date().toISOString(),
                isError: !stageResult.success,
                metadata: {
                    source: "automation",
                    stageIndex: i,
                    stageId: stage.id,
                    stageName: stage.name,
                    stageTotal: automation.stages.length,
                    subRunId,
                    errorKind: stageResult.errorKind,
                },
            };
            await this.appendMainThreadEvent(mainRunId, assistantEvent);
            await agentGraphRunService.incrementConversationTurns(mainRunId);

            const fresh = await agentGraphRunService.getRun(mainRunId);
            if (fresh?.status === "CANCELLED" || fresh?.status === "PAUSED") {
                break;
            }
        }

        const totalDuration = Date.now() - startTime;
        const allSucceeded = stageResults.every((r) => r.success);
        const finalRun = await agentGraphRunService.getRun(mainRunId);
        const finalStatus = finalRun?.status === "CANCELLED" || finalRun?.status === "PAUSED"
            ? finalRun.status
            : (allSucceeded ? "COMPLETED" : "FAILED");

        await agentGraphRunService.updateRunStatus(mainRunId, finalStatus, {
            endedAt: new Date(),
            automationStageResults: stageResults,
            ...(allSucceeded ? {} : { error: stageResults.find((r) => !r.success)?.error }),
        } as any);

        console.info(`[AutomationExecutor] Automation ${automation._id} thread ${mainRunId} ${finalStatus} in ${totalDuration}ms`);
    }

    private summariseStageResult(input: {
        stage: AutomationStageConfig;
        stageIndex: number;
        result: AgentWorkflowResult;
        duration: number;
        success: boolean;
        subRunId?: string;
    }): AutomationStageRunResult {
        const rawReportOutput = input.result.outputs?.report ?? input.result.conclusion ?? "";
        const rawOutput = extractRawReportText(rawReportOutput);
        const findingsCount = Array.isArray(input.result.outputs?.findings)
            ? input.result.outputs!.findings.length
            : 0;
        const claimsCount = Array.isArray(input.result.outputs?.raw_claims)
            ? input.result.outputs!.raw_claims.length
            : 0;
        const tasksCount = Array.isArray(input.result.outputs?.tasks)
            ? input.result.outputs!.tasks.length
            : 0;
        return {
            stageId: input.stage.id,
            stageName: input.stage.name,
            stageIndex: input.stageIndex,
            subRunId: input.subRunId,
            success: input.success,
            findingsCount,
            claimsCount,
            tasksCount,
            rawOutput,
            duration: input.duration,
        };
    }

    /**
     * Atomically increment the schedule execution count, update last/next scheduled dates.
     * Used by the AutomationScheduler after each scheduled run.
     */
    async incrementScheduleCount(chainId: string): Promise<void> {
        const db = await getDb();
        const automation = await this.getAutomation(chainId);
        if (!automation?.schedule) return;

        const now = new Date();
        const nextRun = computeNextRun(automation.schedule.cron, automation.schedule.timezone, now);
        const newCount = (automation.schedule.executionCount ?? 0) + 1;

        const update: Record<string, unknown> = {
            "schedule.executionCount": newCount,
            "schedule.lastScheduledAt": now,
            "schedule.nextScheduledAt": nextRun ?? null,
        };

        if (automation.schedule.maxRuns && newCount >= automation.schedule.maxRuns) {
            update["schedule.enabled"] = false;
            update["schedule.nextScheduledAt"] = null;
            console.info(`[AutomationExecutor] Automation ${chainId} reached maxRuns (${automation.schedule.maxRuns}), disabling schedule.`);
        }

        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(chainId) },
            { $set: update }
        );
    }

    /**
     * List automations that are due for scheduled execution.
     */
    async listDueScheduledAutomations(): Promise<AutomationDefinition[]> {
        const db = await getDb();
        const now = new Date();

        const automations = await db
            .collection(COLLECTION_NAME)
            .find({
                triggerType: "schedule",
                "schedule.enabled": true,
                "schedule.nextScheduledAt": { $lte: now },
            })
            .toArray();

        return automations as AutomationDefinition[];
    }

    /**
     * List automations configured for a specific git event trigger.
     */
    async listGitEventAutomations(eventType: string, branch?: string): Promise<AutomationDefinition[]> {
        const db = await getDb();

        const query: any = {
            triggerType: "git_event",
            "gitEventConfig.events": eventType,
        };

        const automations = await db
            .collection(COLLECTION_NAME)
            .find(query)
            .toArray() as AutomationDefinition[];

        if (branch) {
            return automations.filter((a) => {
                const branches = a.gitEventConfig?.branches;
                if (!branches || branches.length === 0) return true;
                return branches.some((pattern) => {
                    if (pattern === branch) return true;
                    if (pattern.endsWith("/*")) {
                        const prefix = pattern.slice(0, -1);
                        return branch.startsWith(prefix);
                    }
                    return false;
                });
            });
        }

        return automations;
    }

    /**
     * Seed all automation templates from AutomationConfigBuilder.PRESETS (idempotent by name + workspace).
     * Pass workspaceId for tenant-scoped automations (recommended for the app API).
     */
    async ensureDefaultAutomations(workspaceId?: string): Promise<{ created: string[]; skipped: string[] }> {
        const { AutomationConfigBuilder } = await import("@kletron/shared/automationConfigBuilder");
        const db = await getDb();
        const created: string[] = [];
        const skipped: string[] = [];
        const wid = workspaceId ? toObjectId(workspaceId) : undefined;

        for (const presetKey of AutomationConfigBuilder.getPresetNames()) {
            const partial = AutomationConfigBuilder.buildAutomation(presetKey);
            if (!partial.name?.trim() || !partial.stages?.length) continue;

            const query: Record<string, unknown> = { name: partial.name };
            if (wid) {
                query.workspaceId = wid;
            }

            const existing = await db.collection(COLLECTION_NAME).findOne(query);
            if (existing) {
                skipped.push(partial.name);
                continue;
            }

            const id = await this.createAutomation({
                ...partial,
                name: partial.name,
                description: partial.description ?? "",
                stages: partial.stages,
                triggerType: partial.triggerType ?? "manual",
                ...(wid ? { workspaceId: wid } : {}),
            } as any);

            console.info(`[AutomationExecutor] Seeded preset "${presetKey}": ${partial.name} (${id})`);
            created.push(partial.name);
        }

        return { created, skipped };
    }

    /**
     * Rewrite automation stage graphId / provider for legacy keys and canonical hex alignment
     * (see @kletron/shared/canonicalStageGraphs).
     */
    async reconcileAutomationStageGraphs(): Promise<{ updated: number }> {
        const { alignAutomationStagesToWorkspaceGraphs } = await import("@kletron/shared/canonicalStageGraphs");
        const graphs = await agentGraphService.listGraphs();
        const graphList = graphs.map((g) => ({ id: String(g._id), name: g.name }));
        const db = await getDb();
        const docs = await db.collection(COLLECTION_NAME).find({}).toArray();
        let updated = 0;

        for (const doc of docs) {
            const stages = doc.stages as AutomationStageConfig[] | undefined;
            if (!stages?.length) continue;
            const next = alignAutomationStagesToWorkspaceGraphs(stages, graphList);
            if (JSON.stringify(next) === JSON.stringify(stages)) continue;
            await db.collection(COLLECTION_NAME).updateOne({ _id: doc._id }, { $set: { stages: next } });
            updated++;
        }

        if (updated > 0) {
            console.info(`[AutomationExecutor] Reconciled stage graphs on ${updated} automation(s)`);
        }
        return { updated };
    }
}

export const automationExecutor = new AutomationExecutor();
