import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { runWorkflow } from "@numezis/agent-core/workflows";
import { auditService } from "./auditService";
import type {
    AuditChain,
    ChainStatus,
    ChainFilter,
    ChainResult,
    ChainProgress,
    StageResult,
    Finding,
    Insight,
    AuditStageConfig,
    AuditRun,
} from "@numezis/shared/chainTypes";
import type { Claim as WorkflowClaim, Task as WorkflowTask, AgentWorkflowResult } from "@numezis/shared/types";

const COLLECTION_NAME = "audit_chains";
const RUNS_COLLECTION = "audit_runs";

const toObjectId = (id?: string): ObjectId | undefined => {
    if (!id) return undefined;
    if (!ObjectId.isValid(id)) return undefined;
    return new ObjectId(id);
};

/**
 * ChainExecutor - Orchestrates multi-stage audit workflows
 *
 * Core responsibilities:
 * - Create and manage chains
 * - Execute stages sequentially
 * - Handle context passing between stages
 * - Aggregate results and detect insights
 * - Persist state to MongoDB
 */
export class ChainExecutor {
    /**
     * Create a new audit chain
     */
    async createChain(
        config: Omit<
            AuditChain,
            "_id" | "status" | "createdAt" | "currentStageIndex" | "sessionIds" | "aggregatedFindings" | "crossStageInsights"
        >
    ): Promise<string> {
        const db = await getDb();

        const workspaceId =
            typeof (config as any).workspaceId === "string"
                ? toObjectId((config as any).workspaceId)
                : (config as any).workspaceId;

        const chain: AuditChain = {
            ...config,
            ...(workspaceId ? { workspaceId } : {}),
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
     * Get chain by ID
     */
    async getChain(chainId: string, workspaceId?: string): Promise<AuditChain | null> {
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

        return chain as AuditChain | null;
    }

    /**
     * List chains with optional filtering
     */
    async listChains(filter?: ChainFilter): Promise<AuditChain[]> {
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

        const chains = await db
            .collection(COLLECTION_NAME)
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        return chains as AuditChain[];
    }

    /**
     * Update chain status
     */
    async updateChainStatus(
        chainId: string,
        status: ChainStatus,
        updates?: Partial<AuditChain>,
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
     * Update chain configuration
     */
    async updateChain(
        chainId: string,
        updates: Partial<AuditChain>,
        workspaceId?: string
    ): Promise<void> {
        const db = await getDb();
        // Remove _id from updates if it exists to avoid MongoDB error
        const { _id: _, workspaceId: __, ...updateData } = updates as any;

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
        status: ChainStatus,
        updates?: Partial<AuditRun>,
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
        await db.collection<AuditRun>(RUNS_COLLECTION).updateOne(query, updateDoc);
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
        await db.collection<AuditRun>(RUNS_COLLECTION).updateOne(
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
    async getRun(runId: string, workspaceId?: string): Promise<AuditRun | null> {
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

        return run as AuditRun | null;
    }

    /**
     * Get latest run for a chain
     */
    async getLatestRun(chainId: string, workspaceId?: string): Promise<AuditRun | null> {
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

        return (runs[0] as AuditRun) || null;
    }

    /**
     * List runs for a chain
     */
    async listRuns(chainId: string, workspaceId?: string): Promise<AuditRun[]> {
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

        return runs as AuditRun[];
    }

    /**
     * Start a new execution run for a campaign
     */
    async startNewRun(chainId: string, workspaceId?: string): Promise<string> {
        const db = await getDb();
        const chain = await this.getChain(chainId, workspaceId);
        if (!chain) throw new Error(`Campaign ${chainId} not found`);

        const workspaceObjectId = workspaceId ? toObjectId(workspaceId) : undefined;
        if (workspaceId && !workspaceObjectId) {
            throw new Error("Invalid workspace ID");
        }
        if (
            workspaceObjectId &&
            chain.workspaceId &&
            chain.workspaceId.toString() !== workspaceObjectId.toString()
        ) {
            throw new Error("Workspace mismatch for campaign");
        }

        const run: AuditRun = {
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
     * Execute a complete chain by starting a new run
     */
    async executeChain(
        chainId: string,
        onProgress?: (update: ChainProgress) => void
    ): Promise<ChainResult> {
        const runId = await this.startNewRun(chainId);
        return this.executeRun(runId, onProgress);
    }

    /**
     * Execute a specific run
     */
    async executeRun(
        runId: string,
        onProgress?: (update: ChainProgress) => void
    ): Promise<ChainResult> {
        let run = await this.getRun(runId);
        if (!run) throw new Error(`Run ${runId} not found`);

        const chain = await this.getChain(
            run.chainId.toString(),
            run.workspaceId?.toString()
        );
        if (!chain) throw new Error(`Campaign ${run.chainId} not found`);

        // If run was cancelled before we started, don't restart it.
        if (run.status === "CANCELLED") {
            console.info(`[ChainExecutor] Run ${runId} is cancelled. Skipping execution.`);
            return {
                chainId: chain._id!.toString(),
                success: false,
                stages: [],
                aggregation: { findings: [], insights: [], report: "", stats: { totalStages: 0, totalFindings: 0, criticalCount: 0, warningCount: 0 } }
            };
        }

        await this.updateRunStatus(runId, "RUNNING", undefined, run.workspaceId?.toString());
        // Also update parent chain status
        await this.updateChainStatus(run.chainId.toString(), "RUNNING", undefined, run.workspaceId?.toString());

        const results: StageResult[] = [];
        const startTime = Date.now();

        // Execute each stage sequentially
        for (let i = run.currentStageIndex; i < chain.stages.length; i++) {
            // Check if run was paused or cancelled (best-effort: takes effect between stages)
            const currentRun = await this.getRun(runId);
            if (currentRun?.status === "PAUSED") {
                console.info(`[ChainExecutor] Run ${runId} is paused. Stopping execution loop.`);
                return {
                    chainId: chain._id!.toString(),
                    success: false,
                    stages: results,
                    aggregation: { findings: [], insights: [], report: "", stats: { totalStages: 0, totalFindings: 0, criticalCount: 0, warningCount: 0 } }
                };
            }
            if (currentRun?.status === "CANCELLED") {
                console.info(`[ChainExecutor] Run ${runId} is cancelled. Stopping execution loop.`);
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
                console.info(`[ChainExecutor] Skipping stage ${stage.id}: condition met`);
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
            const stageResult = await this.executeStage(chain._id!.toString(), stage, results, {
                userPrompt,
                auditSessionId,
            });
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
                    console.info(`[ChainExecutor] Retrying stage ${stage.id}...`);
                    i--;
                    results[results.length - 1].retries = (stageResult.retries || 0) + 1;
                } else {
                    // Fail entire run
                    await this.updateRunStatus(runId, "FAILED", {
                        endedAt: new Date(),
                    }, run.workspaceId?.toString());
                    await this.updateChainStatus(run.chainId.toString(), "FAILED", undefined, run.workspaceId?.toString());
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

        // Also update parent chain status
        await this.updateChainStatus(chain._id!.toString(), "COMPLETED", undefined, run.workspaceId?.toString());

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
        stage: AuditStageConfig,
        previousResults: StageResult[],
        prepared?: { userPrompt?: string; auditSessionId?: string }
    ): Promise<StageResult> {
        const startTime = Date.now();

        try {
            // Build user prompt from stage prompt + context
            const context = prepared?.userPrompt ? null : this.buildStageContext(stage, previousResults);
            const userPrompt = prepared?.userPrompt ?? this.buildUserPrompt(stage, context);
            const auditSessionId = prepared?.auditSessionId || "";

            console.info(`[ChainExecutor] Executing stage: ${stage.name} (Graph: ${stage.graphId})`);
            console.info(`[ChainExecutor] Input: ${userPrompt.substring(0, 100)}...`);

            // Execute the selected graph workflow
            const workflowResult = await runWorkflow(userPrompt, stage.graphId, {
                llmSelection: {
                    provider: stage.llmProvider,
                    model: stage.llmModel,
                },
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
            console.error(`[ChainExecutor] Stage ${stage.id} failed:`, error);
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
        stage: AuditStageConfig,
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
    private buildUserPrompt(stage: AuditStageConfig, context: any): string {
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
            console.error(`[ChainExecutor] Error evaluating skip condition:`, error);
            return false;
        }
    }

    /**
     * Aggregate results across all stages
     */
    private async aggregateResults(
        chainId: string,
        results: StageResult[]
    ): Promise<ChainResult["aggregation"]> {
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

        lines.push("# Chain Execution Report");
        lines.push("");
        lines.push(`**Chain ID**: \`${chainId}\``);
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
     * Pause a running chain
     */
    async pauseChain(chainId: string, workspaceId?: string): Promise<void> {
        const latestRun = await this.getLatestRun(chainId, workspaceId);
        if (latestRun && latestRun.status === "RUNNING") {
            await this.updateRunStatus(latestRun._id!.toString(), "PAUSED", undefined, workspaceId);
        }
        await this.updateChainStatus(chainId, "PAUSED", undefined, workspaceId);
    }

    /**
     * Resume a paused chain
     */
    async resumeChain(chainId: string, workspaceId?: string): Promise<void> {
        const chain = await this.getChain(chainId, workspaceId);
        if (!chain) {
            throw new Error(`Chain ${chainId} not found`);
        }

        const latestRun = await this.getLatestRun(chainId, workspaceId);
        if (!latestRun) {
            throw new Error(`No run found for chain ${chainId} to resume`);
        }

        await this.updateChainStatus(chainId, "RUNNING", undefined, workspaceId);

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

        // Also update parent chain status (represents latest run status)
        await this.updateChainStatus(run.chainId.toString(), "CANCELLED", undefined, run.workspaceId?.toString());
    }

    /**
     * Cancel the latest run of a campaign
     */
    async cancelChain(chainId: string, workspaceId?: string): Promise<{ runId: string }> {
        const latestRun = await this.getLatestRun(chainId, workspaceId);
        if (!latestRun) throw new Error(`No run found for chain ${chainId} to cancel`);
        await this.cancelRun(latestRun._id!.toString());
        return { runId: latestRun._id!.toString() };
    }

    /**
     * Delete a chain
     */
    async deleteChain(chainId: string, workspaceId?: string): Promise<void> {
        const db = await getDb();
        const query: Record<string, unknown> = { _id: new ObjectId(chainId) };
        if (workspaceId) {
            const workspaceObjectId = toObjectId(workspaceId);
            if (!workspaceObjectId) return;
            query.workspaceId = workspaceObjectId;
        }
        await db.collection(COLLECTION_NAME).deleteOne(query);
    }
}

// Export singleton instance
export const chainExecutor = new ChainExecutor();
