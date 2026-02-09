import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";
import { getDb } from "../lib/db";
import { runWorkflow } from "@numezis/agent-core/workflows";
import { AgentWorkflowAbortError } from "@numezis/agent-core/reactAgentRunner";
import { auditService } from "./auditService";
import type {
    AutomationDefinition,
    AutomationStatus,
    AutomationFilter,
    AutomationResult,
    AutomationProgress,
    StageResult,
    Finding,
    Insight,
    AutomationStageConfig,
    AutomationRun,
} from "@numezis/shared/automationTypes";
import type { AgentWorkflowAbortReason } from "@numezis/shared/types";
import type { Claim as WorkflowClaim, Task as WorkflowTask, AgentWorkflowResult } from "@numezis/shared/types";
import { computeNextRun } from "@numezis/shared/cronUtils";

const COLLECTION_NAME = "audit_chains"; // Legacy collection name - kept for backward compatibility
const RUNS_COLLECTION = "audit_runs"; // Legacy collection name - kept for backward compatibility

const toObjectId = (id?: string): ObjectId | undefined => {
    if (!id) return undefined;
    if (!ObjectId.isValid(id)) return undefined;
    return new ObjectId(id);
};

/**
 * AutomationExecutor - Orchestrates multi-stage audit workflows
 *
 * Core responsibilities:
 * - Create and manage automations
 * - Execute stages sequentially
 * - Handle context passing between stages
 * - Aggregate results and detect insights
 * - Persist state to MongoDB
 */
export class AutomationExecutor {
    /**
     * Create a new automation
     */
    async createAutomation(
        config: Omit<
            AutomationDefinition,
            "_id" | "status" | "createdAt" | "currentStageIndex" | "sessionIds" | "aggregatedFindings" | "crossStageInsights"
        >
    ): Promise<string> {
        const db = await getDb();

        const workspaceId =
            typeof (config as any).workspaceId === "string"
                ? toObjectId((config as any).workspaceId)
                : (config as any).workspaceId;

        const triggerType = config.triggerType || "manual";

        // Auto-generate webhook secret if needed
        let webhookConfig = config.webhookConfig;
        if (triggerType === "webhook" && !webhookConfig?.secret) {
            webhookConfig = {
                ...webhookConfig,
                secret: randomBytes(32).toString("hex"),
            };
        }

        // Auto-generate git event secret if needed
        let gitEventConfig = config.gitEventConfig;
        if (triggerType === "git_event" && gitEventConfig && !gitEventConfig.secret) {
            gitEventConfig = {
                ...gitEventConfig,
                secret: randomBytes(32).toString("hex"),
            };
        }

        // Compute next scheduled run if schedule trigger
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
            status: "PENDING",
            createdAt: new Date(),
            currentStageIndex: 0,
            sessionIds: [],
            aggregatedFindings: [],
            crossStageInsights: [],
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
            query.workspaceId = workspaceObjectId;
        }
        const chain = await db
            .collection(COLLECTION_NAME)
            .findOne(query);

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
            query.workspaceId = workspaceObjectId;
        }

        if (filter?.status) {
            query.status = filter.status;
        }

        if (filter?.search) {
            query.$or = [
                { name: { $regex: filter.search, $options: "i" } },
                { description: { $regex: filter.search, $options: "i" } },
            ];
        }

        if (filter?.scheduledOnly) {
            query["schedule.enabled"] = true;
        }

        if (filter?.triggerType) {
            query.triggerType = filter.triggerType;
        }

        const chains = await db
            .collection(COLLECTION_NAME)
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        return chains as AutomationDefinition[];
    }

    /**
     * Update automation status
     */
    async updateAutomationStatus(
        chainId: string,
        status: AutomationStatus,
        updates?: Partial<AutomationDefinition>,
        workspaceId?: string
    ): Promise<void> {
        const db = await getDb();
        const query: Record<string, unknown> = { _id: new ObjectId(chainId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return;
            query.workspaceId = workspaceObjectId;
        }
        await db.collection(COLLECTION_NAME).updateOne(
            query,
            {
                $set: {
                    status,
                    ...updates,
                },
            }
        );
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
        // Remove _id from updates if it exists to avoid MongoDB error
        const { _id: _, workspaceId: __, ...updateData } = updates as any;

        const triggerType = updateData.triggerType || "manual";

        // Auto-generate webhook secret if switching to webhook and none exists
        if (triggerType === "webhook" && !updateData.webhookConfig?.secret) {
            const existing = await this.getAutomation(chainId, workspaceId);
            if (!existing?.webhookConfig?.secret) {
                updateData.webhookConfig = {
                    ...updateData.webhookConfig,
                    secret: randomBytes(32).toString("hex"),
                };
            }
        }

        // Auto-generate git event secret if switching to git_event and none exists
        if (triggerType === "git_event" && updateData.gitEventConfig && !updateData.gitEventConfig.secret) {
            const existing = await this.getAutomation(chainId, workspaceId);
            if (!existing?.gitEventConfig?.secret) {
                updateData.gitEventConfig = {
                    ...updateData.gitEventConfig,
                    secret: randomBytes(32).toString("hex"),
                };
            }
        }

        // Recompute nextScheduledAt when schedule is present
        if (triggerType === "schedule" && updateData.schedule?.enabled && updateData.schedule.cron && updateData.schedule.timezone) {
            const existing = await this.getAutomation(chainId, workspaceId);
            const nextRun = computeNextRun(updateData.schedule.cron, updateData.schedule.timezone);
            updateData.schedule = {
                ...updateData.schedule,
                executionCount: existing?.schedule?.executionCount ?? 0,
                lastScheduledAt: existing?.schedule?.lastScheduledAt ?? undefined,
                nextScheduledAt: nextRun ?? undefined,
            };
        }

        const query: Record<string, unknown> = { _id: new ObjectId(chainId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return;
            query.workspaceId = workspaceObjectId;
        }

        await db.collection(COLLECTION_NAME).updateOne(
            query,
            { $set: updateData }
        );
    }

    /**
     * Update run status
     */
    async updateRunStatus(
        runId: string,
        status: AutomationStatus,
        updates?: Partial<AutomationRun>,
        workspaceId?: string
    ): Promise<void> {
        const db = await getDb();
        const query: Record<string, unknown> = { _id: new ObjectId(runId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return;
            query.workspaceId = workspaceObjectId;
        }
        await db.collection(RUNS_COLLECTION).updateOne(
            query,
            {
                $set: {
                    status,
                    ...updates,
                },
            }
        );
    }

    /**
     * Update run progress during execution
     */
    async updateRunProgress(
        runId: string,
        stageIndex: number,
        sessionId: string,
        workspaceId?: string
    ): Promise<void> {
        const db = await getDb();
        const query: Record<string, unknown> = { _id: new ObjectId(runId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return;
            query.workspaceId = workspaceObjectId;
        }
        const updateDoc: Record<string, any> = {
            $set: {
                currentStageIndex: stageIndex,
            },
        };
        if (sessionId) {
            updateDoc.$set[`sessionIds.${stageIndex}`] = sessionId;
        }
        await db.collection<AutomationRun>(RUNS_COLLECTION).updateOne(query, updateDoc);
    }

    /**
     * Update only the current stage index (no session mutation)
     */
    async updateRunStageIndex(
        runId: string,
        stageIndex: number,
        workspaceId?: string
    ): Promise<void> {
        const db = await getDb();
        const query: Record<string, unknown> = { _id: new ObjectId(runId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return;
            query.workspaceId = workspaceObjectId;
        }
        await db.collection<AutomationRun>(RUNS_COLLECTION).updateOne(
            query,
            {
                $set: {
                    currentStageIndex: stageIndex,
                },
            }
        );
    }

    /**
     * Get run by ID
     */
    async getRun(runId: string, workspaceId?: string): Promise<AutomationRun | null> {
        const db = await getDb();
        const query: Record<string, unknown> = { _id: new ObjectId(runId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return null;
            query.workspaceId = workspaceObjectId;
        }
        const run = await db
            .collection(RUNS_COLLECTION)
            .findOne(query);

        return run as AutomationRun | null;
    }

    /**
     * Get latest run for an automation
     */
    async getLatestRun(chainId: string, workspaceId?: string): Promise<AutomationRun | null> {
        const db = await getDb();
        const query: Record<string, unknown> = { chainId: new ObjectId(chainId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return null;
            query.workspaceId = workspaceObjectId;
        }
        const runs = await db
            .collection(RUNS_COLLECTION)
            .find(query)
            .sort({ startedAt: -1 })
            .limit(1)
            .toArray();

        return (runs[0] as AutomationRun) || null;
    }

    /**
     * List runs for an automation
     */
    async listRuns(chainId: string, workspaceId?: string): Promise<AutomationRun[]> {
        const db = await getDb();
        const query: Record<string, unknown> = { chainId: new ObjectId(chainId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return [];
            query.workspaceId = workspaceObjectId;
        }
        const runs = await db
            .collection(RUNS_COLLECTION)
            .find(query)
            .sort({ startedAt: -1 })
            .toArray();

        return runs as AutomationRun[];
    }

    /**
     * Start a new execution run for an automation
     */
    async startNewRun(chainId: string, workspaceId?: string): Promise<string> {
        const db = await getDb();
        const chain = await this.getAutomation(chainId, workspaceId);
        if (!chain) throw new Error(`Automation ${chainId} not found`);

        const workspaceObjectId = workspaceId ? toObjectId(workspaceId) : undefined;
        if (workspaceId && !workspaceObjectId) {
            throw new Error("Invalid workspace ID");
        }
        if (
            workspaceObjectId &&
            chain.workspaceId &&
            chain.workspaceId.toString() !== workspaceObjectId.toString()
        ) {
            throw new Error("Workspace mismatch for automation");
        }

        const run: AutomationRun = {
            chainId: new ObjectId(chainId),
            ...(chain.workspaceId
                ? { workspaceId: chain.workspaceId }
                : workspaceObjectId
                ? { workspaceId: workspaceObjectId }
                : {}),
            status: "PENDING",
            startedAt: new Date(),
            currentStageIndex: 0,
            sessionIds: [],
            aggregatedFindings: [],
            crossStageInsights: [],
        };

        const result = await db.collection(RUNS_COLLECTION).insertOne(run);
        return result.insertedId.toString();
    }

    /**
     * Execute a complete automation by starting a new run
     */
    async executeAutomation(
        chainId: string,
        onProgress?: (update: AutomationProgress) => void
    ): Promise<AutomationResult> {
        const runId = await this.startNewRun(chainId);
        return this.executeRun(runId, onProgress);
    }

    /**
     * Execute a specific run
     */
    async executeRun(
        runId: string,
        onProgress?: (update: AutomationProgress) => void
    ): Promise<AutomationResult> {
        let run = await this.getRun(runId);
        if (!run) throw new Error(`Run ${runId} not found`);

        const chain = await this.getAutomation(
            run.chainId.toString(),
            run.workspaceId?.toString()
        );
        if (!chain) throw new Error(`Automation ${run.chainId} not found`);

        // If run was cancelled before we started, don't restart it.
        if (run.status === "CANCELLED") {
            console.info(`[AutomationExecutor] Run ${runId} is cancelled. Skipping execution.`);
            return {
                chainId: chain._id!.toString(),
                success: false,
                stages: [],
                aggregation: { findings: [], insights: [], report: "", stats: { totalStages: 0, totalFindings: 0, criticalCount: 0, warningCount: 0 } }
            };
        }

        await this.updateRunStatus(runId, "RUNNING", undefined, run.workspaceId?.toString());
        // Also update parent automation status
        await this.updateAutomationStatus(run.chainId.toString(), "RUNNING", undefined, run.workspaceId?.toString());

        const results: StageResult[] = [];
        const startTime = Date.now();
        const runWorkspaceId = run.workspaceId?.toString();
        const shouldAbort = (() => {
            let lastCheck = 0;
            let cachedReason: AgentWorkflowAbortReason | null = null;
            const CHECK_INTERVAL_MS = 500;
            return async () => {
                if (cachedReason) return cachedReason;
                const now = Date.now();
                if (now - lastCheck < CHECK_INTERVAL_MS) return null;
                lastCheck = now;
                const current = await this.getRun(runId, runWorkspaceId);
                if (current?.status === "PAUSED") {
                    cachedReason = "PAUSED";
                    return cachedReason;
                }
                if (current?.status === "CANCELLED") {
                    cachedReason = "CANCELLED";
                    return cachedReason;
                }
                return null;
            };
        })();

        // Execute each stage sequentially
        for (let i = run.currentStageIndex; i < chain.stages.length; i++) {
            // Check if run was paused or cancelled (best-effort: takes effect between stages)
            const currentRun = await this.getRun(runId, runWorkspaceId);
            if (currentRun?.status === "PAUSED") {
                console.info(`[AutomationExecutor] Run ${runId} is paused. Stopping execution loop.`);
                return {
                    chainId: chain._id!.toString(),
                    success: false,
                    stages: results,
                    aggregation: { findings: [], insights: [], report: "", stats: { totalStages: 0, totalFindings: 0, criticalCount: 0, warningCount: 0 } }
                };
            }
            if (currentRun?.status === "CANCELLED") {
                console.info(`[AutomationExecutor] Run ${runId} is cancelled. Stopping execution loop.`);
                return {
                    chainId: chain._id!.toString(),
                    success: false,
                    stages: results,
                    aggregation: { findings: [], insights: [], report: "", stats: { totalStages: results.length, totalFindings: results.flatMap((r) => r.findings).length, criticalCount: 0, warningCount: 0 } }
                };
            }

            const stage = chain.stages[i];

            // Notify progress
            onProgress?.({
                chainId: chain._id!.toString(),
                stageIndex: i,
                status: "RUNNING",
            });

            // Check skip condition
            if (stage.skipIf && this.evaluateSkipCondition(stage.skipIf, results)) {
                console.info(`[AutomationExecutor] Skipping stage ${stage.id}: condition met`);
                onProgress?.({
                    chainId: chain._id!.toString(),
                    stageIndex: i,
                    status: "SKIPPED",
                });
                await this.updateRunStageIndex(runId, i + 1, run.workspaceId?.toString());
                continue;
            }

            const context = this.buildStageContext(stage, results);
            const userPrompt = this.buildUserPrompt(stage, context);
            const auditSessionId = await auditService.createSession(userPrompt);
            if (auditSessionId) {
                await this.updateRunProgress(runId, i, auditSessionId, run.workspaceId?.toString());
            } else {
                await this.updateRunStageIndex(runId, i, run.workspaceId?.toString());
            }

            // Execute stage
            let stageResult: StageResult;
            try {
                stageResult = await this.executeStage(chain._id!.toString(), stage, results, {
                    userPrompt,
                    auditSessionId,
                    workspaceId: runWorkspaceId,
                    shouldAbort,
                });
            } catch (error) {
                if (error instanceof AgentWorkflowAbortError || (error as any)?.name === "AgentWorkflowAbortError") {
                    const reason: AgentWorkflowAbortReason = (error as any).reason ?? "PAUSED";
                    const status: AutomationStatus = reason === "CANCELLED" ? "CANCELLED" : "PAUSED";
                    await this.updateRunStatus(
                        runId,
                        status,
                        reason === "CANCELLED" ? { endedAt: new Date() } : undefined,
                        runWorkspaceId
                    );
                    await this.updateAutomationStatus(run.chainId.toString(), status, undefined, runWorkspaceId);
                    return {
                        chainId: chain._id!.toString(),
                        success: false,
                        stages: results,
                        aggregation: {
                            findings: [],
                            insights: [],
                            report: "",
                            stats: {
                                totalStages: results.length,
                                totalFindings: results.flatMap((r) => r.findings).length,
                                criticalCount: 0,
                                warningCount: 0,
                            },
                        },
                    };
                }
                throw error;
            }
            results.push(stageResult);

            // Update run progress
            await this.updateRunStageIndex(runId, i + 1, run.workspaceId?.toString());

            // Notify progress
            onProgress?.({
                chainId: chain._id!.toString(),
                stageIndex: i,
                status: stageResult.success ? "COMPLETED" : "FAILED",
                findings: stageResult.findings,
            });

            // Handle failures
            if (!stageResult.success) {
                if (
                    stage.retryOnFailure &&
                    (stageResult.retries || 0) < (stage.maxRetries || 3)
                ) {
                    // Retry same stage
                    console.info(`[AutomationExecutor] Retrying stage ${stage.id}...`);
                    i--;
                    results[results.length - 1].retries = (stageResult.retries || 0) + 1;
                } else {
                    // Fail entire run
                    await this.updateRunStatus(runId, "FAILED", {
                        endedAt: new Date(),
                    }, run.workspaceId?.toString());
                    await this.updateAutomationStatus(run.chainId.toString(), "FAILED", undefined, run.workspaceId?.toString());
                    throw new Error(`Stage ${stage.id} failed: ${stageResult.error}`);
                }
            }
        }

        // Aggregate results
        const aggregation = await this.aggregateResults(chain._id!.toString(), results);

        const totalDuration = Date.now() - startTime;

        // Update final run state
        await this.updateRunStatus(runId, "COMPLETED", {
            endedAt: new Date(),
            aggregatedFindings: aggregation.findings,
            crossStageInsights: aggregation.insights,
            finalReport: aggregation.report,
            metadata: {
                totalDuration,
                totalClaims: results.reduce((sum, r) => sum + r.claims.length, 0),
                totalVerified: results.reduce(
                    (sum, r) =>
                        sum +
                        r.findings.filter((f) => f.verificationStatus === "VERIFIED").length,
                    0
                ),
                totalRejected: results.reduce(
                    (sum, r) =>
                        sum +
                        r.findings.filter((f) => f.verificationStatus === "REJECTED").length,
                    0
                ),
            },
        }, run.workspaceId?.toString());

        // Also update parent automation status
        await this.updateAutomationStatus(chain._id!.toString(), "COMPLETED", undefined, run.workspaceId?.toString());

        return {
            chainId: chain._id!.toString(),
            success: results.every((r) => r.success),
            stages: results,
            aggregation,
        };
    }

    /**
     * Execute a single stage
     */
    private async executeStage(
        chainId: string,
        stage: AutomationStageConfig,
        previousResults: StageResult[],
        prepared?: {
            userPrompt?: string;
            auditSessionId?: string;
            workspaceId?: string;
            shouldAbort?: () => Promise<AgentWorkflowAbortReason | null> | AgentWorkflowAbortReason | null;
        }
    ): Promise<StageResult> {
        const startTime = Date.now();

        try {
            // Build user prompt from stage prompt + context
            const context = prepared?.userPrompt ? null : this.buildStageContext(stage, previousResults);
            const userPrompt = prepared?.userPrompt ?? this.buildUserPrompt(stage, context);
            const auditSessionId = prepared?.auditSessionId || "";

            console.info(`[AutomationExecutor] Executing stage: ${stage.name} (Graph: ${stage.graphId})`);
            console.info(`[AutomationExecutor] Input: ${userPrompt.substring(0, 100)}...`);

            // Execute the selected graph workflow
            const workflowResult = await runWorkflow(userPrompt, stage.graphId, {
                llmSelection: {
                    provider: stage.llmProvider,
                    model: stage.llmModel,
                },
                workspaceId: prepared?.workspaceId,
                shouldAbort: prepared?.shouldAbort,
                ...(auditSessionId
                    ? {
                          onUpdate: async (update) => {
                              await auditService.updateSession(auditSessionId, update as Partial<AgentWorkflowResult>);
                          },
                      }
                    : {}),
            });
            if (auditSessionId) {
                await auditService.completeSession(auditSessionId, workflowResult);
            }
            const sessionIdForLogs = auditSessionId || workflowResult.sessionId;

            // Extract findings
            const findings: Finding[] = (workflowResult.outputs?.findings || []).map(
                (f: any) => ({
                    chainId,
                    stageId: stage.id,
                    sessionId: sessionIdForLogs,
                    type: f.type,
                    file: f.file,
                    description: f.description,
                    lineStart: f.line_start,
                    lineEnd: f.line_end,
                    claimId: f.claim_id,
                    timestamp: new Date(),
                })
            );

            const rawClaims: WorkflowClaim[] = workflowResult.outputs?.raw_claims ?? [];
            const claims = rawClaims.map((rawClaim, index) => ({
                id: `${stage.id}-${index}`,
                file: rawClaim.source ?? "unknown",
                description: rawClaim.claim,
                severity: "INFO" as const,
                evidence: rawClaim.evidence,
            }));
            const rawTasks: WorkflowTask[] = workflowResult.outputs?.tasks ?? [];
            const tasks = rawTasks.map((task, index) => {
                let priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
                if (task.priority === "high") priority = "HIGH";
                if (task.priority === "low") priority = "LOW";
                return {
                    id: `${stage.id}-task-${index}`,
                    title: task.title,
                    description: task.description ?? task.title,
                    priority,
                    relatedFindingIds: [],
                };
            });

            return {
                stageId: stage.id,
                stageName: stage.name,
                sessionId: sessionIdForLogs,
                success: true,
                findings,
                claims,
                tasks,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            if (error instanceof AgentWorkflowAbortError || (error as any)?.name === "AgentWorkflowAbortError") {
                throw error;
            }
            console.error(`[AutomationExecutor] Stage ${stage.id} failed:`, error);
            if (prepared?.auditSessionId) {
                const message = error instanceof Error ? error.message : String(error);
                const fallbackResult: AgentWorkflowResult = {
                    sessionId: prepared.auditSessionId,
                    timeline: [],
                    conclusion: "Stage failed.",
                    outputs: {
                        context: {},
                        target_files: [],
                        raw_claims: [],
                        verified_findings: [],
                        findings: [],
                        tasks: [],
                        report: `ERROR: ${message}`,
                    },
                    eventStream: [],
                };
                await auditService.completeSession(prepared.auditSessionId, fallbackResult, error instanceof Error ? error : new Error(message));
            }
            return {
                stageId: stage.id,
                stageName: stage.name,
                sessionId: prepared?.auditSessionId ?? "",
                success: false,
                error: error instanceof Error ? error.message : String(error),
                findings: [],
                claims: [],
                tasks: [],
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Build context from previous stages
     */
    private buildStageContext(
        stage: AutomationStageConfig,
        previousResults: StageResult[]
    ): any {
        if (!stage.contextFromPreviousStages || stage.contextFromPreviousStages.length === 0) {
            return null;
        }

        const context: any = {};

        for (const selector of stage.contextFromPreviousStages) {
            const [stageId, field] = selector.split(".");
            const prevResult = previousResults.find((r) => r.stageId === stageId);

            if (prevResult && field in prevResult) {
                context[selector] = (prevResult as any)[field];
            }
        }

        return Object.keys(context).length > 0 ? context : null;
    }

    /**
     * Build user prompt with context
     */
    private buildUserPrompt(stage: AutomationStageConfig, context: any): string {
        const basePrompt = stage.prompt?.trim();
        if (!basePrompt) {
            throw new Error(`Stage ${stage.id} has an empty prompt`);
        }

        let prompt = basePrompt;

        if (context) {
            prompt += `\n\n${JSON.stringify(context, null, 2)}`;
        }

        return prompt;
    }

    /**
     * Evaluate skip condition
     */
    private evaluateSkipCondition(
        condition: string,
        previousResults: StageResult[]
    ): boolean {
        try {
            // Create a safe evaluation context
            // Only allow access to previous stage results
            const evalContext: any = {};

            previousResults.forEach((result) => {
                evalContext[result.stageId] = {
                    findings: result.findings,
                    claims: result.claims,
                    success: result.success,
                };
            });

            // Very simple evaluation (SECURITY: only allow safe property access)
            // For MVP, we only support simple conditions like "stageId.findings.length === 0"
            const match = condition.match(/^(\w+)\.findings\.length\s*(===|!==|>|<|>=|<=)\s*(\d+)$/);

            if (match) {
                const [, stageId, operator, value] = match;
                const result = evalContext[stageId];

                if (!result) return false;

                const length = result.findings.length;
                const compareValue = parseInt(value, 10);

                switch (operator) {
                    case "===":
                        return length === compareValue;
                    case "!==":
                        return length !== compareValue;
                    case ">":
                        return length > compareValue;
                    case "<":
                        return length < compareValue;
                    case ">=":
                        return length >= compareValue;
                    case "<=":
                        return length <= compareValue;
                    default:
                        return false;
                }
            }

            return false;
        } catch (error) {
            console.error(`[AutomationExecutor] Error evaluating skip condition:`, error);
            return false;
        }
    }

    /**
     * Aggregate results across all stages
     */
    private async aggregateResults(
        chainId: string,
        results: StageResult[]
    ): Promise<AutomationResult["aggregation"]> {
        const allFindings = results.flatMap((r) => r.findings);

        // Detect hotspots (files flagged by multiple stages)
        const insights = this.detectHotspots(results);

        // Generate final report
        const report = this.generateAggregatedReport(chainId, results, insights);

        return {
            findings: allFindings,
            insights,
            report,
            stats: {
                totalStages: results.length,
                totalFindings: allFindings.length,
                criticalCount: allFindings.filter((f) => f.type === "BLOQUANT").length,
                warningCount: allFindings.filter((f) => f.type === "WARNING").length,
            },
        };
    }

    /**
     * Detect hotspot files (flagged by multiple stages)
     */
    private detectHotspots(results: StageResult[]): Insight[] {
        const insights: Insight[] = [];
        const fileOccurrences = new Map<string, { count: number; stages: string[] }>();

        // Count file occurrences
        results.forEach((result) => {
            result.findings.forEach((finding) => {
                const existing = fileOccurrences.get(finding.file) || {
                    count: 0,
                    stages: [],
                };
                existing.count += 1;
                if (!existing.stages.includes(result.stageId)) {
                    existing.stages.push(result.stageId);
                }
                fileOccurrences.set(finding.file, existing);
            });
        });

        // Create hotspot insights for files flagged by 3+ stages
        fileOccurrences.forEach((data, file) => {
            if (data.count >= 3) {
                insights.push({
                    id: `hotspot-${file.replace(/\//g, "-")}`,
                    type: "HOTSPOT",
                    title: `Hotspot Detected: ${file}`,
                    description: `This file was flagged by ${data.stages.length} different stages (${data.stages.join(", ")})`,
                    relatedFindings: [],
                    confidence: Math.min(data.count * 20, 100),
                    priority: data.count >= 5 ? "CRITICAL" : data.count >= 3 ? "HIGH" : "MEDIUM",
                });
            }
        });

        return insights;
    }

    /**
     * Generate aggregated report
     */
    private generateAggregatedReport(
        chainId: string,
        results: StageResult[],
        insights: Insight[]
    ): string {
        const lines: string[] = [];

        lines.push("# Automation Execution Report");
        lines.push("");
        lines.push(`**Automation ID**: \`${chainId}\``);
        lines.push(`**Stages**: ${results.length}`);
        lines.push(
            `**Status**: ${results.every((r) => r.success) ? "✅ All stages completed" : "❌ Some stages failed"}`
        );
        lines.push("");

        lines.push("## Stage Summary");
        lines.push("");
        results.forEach((result, i) => {
            const icon = result.success ? "✅" : "❌";
            lines.push(
                `${i + 1}. ${icon} **${result.stageName}** - ${result.findings.length} findings (${(result.duration / 1000 / 60).toFixed(1)}m)`
            );
        });
        lines.push("");

        if (insights.length > 0) {
            lines.push("## Cross-Stage Insights");
            lines.push("");
            insights.forEach((insight) => {
                lines.push(`### ${insight.title}`);
                lines.push(`- **Type**: ${insight.type}`);
                lines.push(`- **Priority**: ${insight.priority}`);
                lines.push(`- **Confidence**: ${insight.confidence}%`);
                lines.push(`- **Description**: ${insight.description}`);
                lines.push("");
            });
        }

        lines.push("## Findings Summary");
        lines.push("");
        const allFindings = results.flatMap((r) => r.findings);
        const criticalCount = allFindings.filter((f) => f.type === "BLOQUANT").length;
        const warningCount = allFindings.filter((f) => f.type === "WARNING").length;
        const infoCount = allFindings.filter((f) => f.type === "INFO").length;

        lines.push(`- **Total**: ${allFindings.length}`);
        lines.push(`- **Critical (BLOQUANT)**: ${criticalCount}`);
        lines.push(`- **Warnings**: ${warningCount}`);
        lines.push(`- **Info**: ${infoCount}`);
        lines.push("");

        return lines.join("\n");
    }

    /**
     * Pause a running automation
     */
    async pauseAutomation(chainId: string, workspaceId?: string): Promise<void> {
        const latestRun = await this.getLatestRun(chainId, workspaceId);
        if (latestRun && latestRun.status === "RUNNING") {
            await this.updateRunStatus(latestRun._id!.toString(), "PAUSED", undefined, workspaceId);
        }
        await this.updateAutomationStatus(chainId, "PAUSED", undefined, workspaceId);
    }

    /**
     * Resume a paused automation
     */
    async resumeAutomation(chainId: string, workspaceId?: string): Promise<void> {
        const chain = await this.getAutomation(chainId, workspaceId);
        if (!chain) {
            throw new Error(`Automation ${chainId} not found`);
        }

        const latestRun = await this.getLatestRun(chainId, workspaceId);
        if (!latestRun) {
            throw new Error(`No run found for automation ${chainId} to resume`);
        }

        await this.updateAutomationStatus(chainId, "RUNNING", undefined, workspaceId);

        // Continue execution of the latest run
        await this.executeRun(latestRun._id!.toString());
    }

    /**
     * Cancel a specific run (best-effort: takes effect between stages)
     */
    async cancelRun(runId: string): Promise<void> {
        const run = await this.getRun(runId);
        if (!run) throw new Error(`Run ${runId} not found`);

        await this.updateRunStatus(runId, "CANCELLED", {
            endedAt: new Date(),
        }, run.workspaceId?.toString());

        // Also update parent automation status (represents latest run status)
        await this.updateAutomationStatus(run.chainId.toString(), "CANCELLED", undefined, run.workspaceId?.toString());
    }

    /**
     * Cancel the latest run of an automation
     */
    async cancelAutomation(chainId: string, workspaceId?: string): Promise<{ runId: string }> {
        const latestRun = await this.getLatestRun(chainId, workspaceId);
        if (!latestRun) throw new Error(`No run found for automation ${chainId} to cancel`);
        await this.cancelRun(latestRun._id!.toString());
        return { runId: latestRun._id!.toString() };
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

        // Disable schedule if maxRuns reached
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
     * Returns automations where triggerType is "schedule", schedule is enabled,
     * and nextScheduledAt is in the past (or now).
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

        // Filter by branch if specified
        if (branch) {
            return automations.filter((a) => {
                const branches = a.gitEventConfig?.branches;
                if (!branches || branches.length === 0) return true; // no filter = match all
                return branches.some((pattern) => {
                    if (pattern === branch) return true;
                    // Simple glob: "release/*" matches "release/v1.0"
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
}

// Export singleton instance
export const automationExecutor = new AutomationExecutor();
