import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { runWorkflow } from "../workflows";
import { readPromptFile } from "@/app/api/prompts/utils";
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
} from "./chainTypes";

const COLLECTION_NAME = "audit_chains";

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

        const chain: AuditChain = {
            ...config,
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
    async getChain(chainId: string): Promise<AuditChain | null> {
        const db = await getDb();
        const chain = await db
            .collection(COLLECTION_NAME)
            .findOne({ _id: new ObjectId(chainId) });

        return chain as AuditChain | null;
    }

    /**
     * List chains with optional filtering
     */
    async listChains(filter?: ChainFilter): Promise<AuditChain[]> {
        const db = await getDb();
        const query: any = {};

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
        updates?: Partial<AuditChain>
    ): Promise<void> {
        const db = await getDb();
        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(chainId) },
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
        updates: Partial<AuditChain>
    ): Promise<void> {
        const db = await getDb();
        // Remove _id from updates if it exists to avoid MongoDB error
        const { _id: _, ...updateData } = updates as any;

        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(chainId) },
            { $set: updateData }
        );
    }

    /**
     * Update chain progress during execution
     */
    async updateChainProgress(
        chainId: string,
        stageIndex: number,
        sessionId: string
    ): Promise<void> {
        const db = await getDb();
        await db.collection<AuditChain>(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(chainId) },
            {
                $set: {
                    currentStageIndex: stageIndex,
                },
                $push: {
                    sessionIds: sessionId,
                } as any,
            }
        );
    }

    /**
     * Execute a complete chain
     */
    async executeChain(
        chainId: string,
        onProgress?: (update: ChainProgress) => void
    ): Promise<ChainResult> {
        const chain = await this.getChain(chainId);

        if (!chain) {
            throw new Error(`Chain ${chainId} not found`);
        }

        await this.updateChainStatus(chainId, "RUNNING", { startedAt: new Date() });

        const results: StageResult[] = [];
        const startTime = Date.now();

        // Execute each stage sequentially
        for (let i = chain.currentStageIndex; i < chain.stages.length; i++) {
            const stage = chain.stages[i];

            // Notify progress
            onProgress?.({
                chainId,
                stageIndex: i,
                status: "RUNNING",
            });

            // Check skip condition
            if (stage.skipIf && this.evaluateSkipCondition(stage.skipIf, results)) {
                console.info(`[ChainExecutor] Skipping stage ${stage.id}: condition met`);
                onProgress?.({
                    chainId,
                    stageIndex: i,
                    status: "SKIPPED",
                });
                continue;
            }

            // Execute stage
            const stageResult = await this.executeStage(chainId, stage, results);
            results.push(stageResult);

            // Update chain progress
            await this.updateChainProgress(chainId, i + 1, stageResult.sessionId);

            // Notify progress
            onProgress?.({
                chainId,
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
                    // Fail entire chain
                    await this.updateChainStatus(chainId, "FAILED", {
                        endedAt: new Date(),
                    });
                    throw new Error(`Stage ${stage.id} failed: ${stageResult.error}`);
                }
            }
        }

        // Aggregate results
        const aggregation = await this.aggregateResults(chainId, results);

        const totalDuration = Date.now() - startTime;

        // Update final chain state
        await this.updateChainStatus(chainId, "COMPLETED", {
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
        });

        return {
            chainId,
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
        previousResults: StageResult[]
    ): Promise<StageResult> {
        const startTime = Date.now();

        try {
            // Build context from previous stages
            const context = this.buildStageContext(stage, previousResults);

            // Load prompt from filesystem
            const promptTemplate = await readPromptFile(stage.promptPath);

            // Build user prompt with context
            const userPrompt = this.buildUserPrompt(promptTemplate, context);

            console.info(`[ChainExecutor] Executing stage: ${stage.name} (Graph: ${stage.graphId})`);
            console.info(`[ChainExecutor] Prompt: ${userPrompt.substring(0, 100)}...`);

            // Execute the selected graph workflow
            const workflowResult = await runWorkflow(userPrompt, stage.graphId, {
                llmSelection: {
                    provider: stage.llmProvider,
                    model: stage.llmModel,
                },
                auditContext: context,
            });

            // Extract findings
            const findings: Finding[] = (workflowResult.outputs?.findings || []).map(
                (f: any) => ({
                    chainId,
                    stageId: stage.id,
                    sessionId: workflowResult.sessionId,
                    type: f.type,
                    file: f.file,
                    description: f.description,
                    lineStart: f.line_start,
                    lineEnd: f.line_end,
                    claimId: f.claim_id,
                    timestamp: new Date(),
                })
            );

            return {
                stageId: stage.id,
                stageName: stage.name,
                sessionId: workflowResult.sessionId,
                success: true,
                findings,
                claims: workflowResult.outputs?.raw_claims || [],
                tasks: workflowResult.outputs?.tasks || [],
                duration: Date.now() - startTime,
            };
        } catch (error) {
            console.error(`[ChainExecutor] Stage ${stage.id} failed:`, error);
            return {
                stageId: stage.id,
                stageName: stage.name,
                sessionId: "",
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
    private buildUserPrompt(template: string, context: any): string {
        let prompt = template;

        // If context exists, append it to the prompt
        if (context) {
            prompt += "\n\n--- Context from Previous Stages ---\n";
            prompt += JSON.stringify(context, null, 2);
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
    async pauseChain(chainId: string): Promise<void> {
        await this.updateChainStatus(chainId, "PAUSED");
    }

    /**
     * Resume a paused chain
     */
    async resumeChain(chainId: string): Promise<void> {
        const chain = await this.getChain(chainId);
        if (!chain) {
            throw new Error(`Chain ${chainId} not found`);
        }

        await this.updateChainStatus(chainId, "RUNNING");

        // Continue execution from current stage
        await this.executeChain(chainId);
    }

    /**
     * Delete a chain
     */
    async deleteChain(chainId: string): Promise<void> {
        const db = await getDb();
        await db.collection(COLLECTION_NAME).deleteOne({ _id: new ObjectId(chainId) });
    }
}

// Export singleton instance
export const chainExecutor = new ChainExecutor();
