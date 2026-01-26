import { ObjectId } from "mongodb";
import { readFile } from "fs/promises";
import path from "path";

import { getDb } from "@/src/lib/db";
import { resolveLlmSelection, resolveResolvedLlmInfo, type LlmSelection, getChatModel } from "@/src/llm";
import { ChainConfigBuilder } from "@/src/services/chainConfigBuilder";
import { McpClient } from "@/src/mcp/client";
import { config } from "@/src/config";
import { extractJsonObject } from "@/src/lib/jsonExtract";
import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

export type DriftJobStatus = "queued" | "running" | "success" | "error" | "cancelled";

export type DriftResult = {
    stageId: string;
    stageName: string;
    promptPath: string;
    driftDetected: boolean;
    argumentation: string;
    remediationPlan?: string;
    confidence?: number;
    timestamp: Date;
};

export type DriftJobDoc = {
    _id: ObjectId;
    status: DriftJobStatus;
    createdAt: Date;
    startedAt?: Date;
    finishedAt?: Date;

    // Progress tracking
    totalStages: number;
    processedStages: number;
    currentStageIndex: number;

    // Configuration
    llmSelection?: { provider?: string; model?: string };
    resolvedLlm?: {
        provider: "azure" | "lmstudio";
        model?: string;
        azure?: { deployment?: string; endpoint?: string; apiVersion?: string };
        lmstudio?: { baseUrl?: string };
    };

    // Diff context (snapshot)
    diffSnapshot?: string;

    // Results
    results: DriftResult[];

    error?: string;
    log?: string[];

    // Lock + heartbeat
    lockId?: string;
    lockedAt?: Date;
    heartbeatAt?: Date;
};

const JOBS_COLLECTION = "drift_analysis_jobs";

// Reuse options relative to locking/polling
export type DriftWorkerOptions = {
    pollIntervalMs?: number;
    lockTtlMs?: number;
    heartbeatIntervalMs?: number;
};

const defaultOptions: Required<DriftWorkerOptions> = {
    pollIntervalMs: 1000,
    lockTtlMs: 30 * 60 * 1000,
    heartbeatIntervalMs: 10 * 1000,
};

// --- Schema for LLM Output ---
const DriftAnalysisSchema = z.object({
    driftDetected: z.boolean(),
    argumentation: z.string().describe("Explanation of why drift was or was not detected."),
    remediationPlan: z.string().optional().describe("Steps to fix the drift if detected."),
    confidence: z.number().min(0).max(1).optional()
});

function now() {
    return new Date();
}

async function ensureIndexes() {
    const db = await getDb();
    const jobs = db.collection(JOBS_COLLECTION);
    try {
        await jobs.createIndex({ status: 1, createdAt: -1 });
        await jobs.createIndex({ heartbeatAt: 1 });
    } catch { }
}

async function appendLogLine(db: any, jobId: ObjectId, line: string) {
    await db.collection(JOBS_COLLECTION).updateOne(
        { _id: jobId },
        {
            $push: {
                log: {
                    $each: [line],
                    $slice: -80,
                },
            },
        }
    );
}

// --- LLM Logic ---

async function analyzeStage(
    stage: { id: string; name: string; promptPath: string },
    diff: string,
    llmSelection?: Partial<LlmSelection>
): Promise<DriftResult> {
    // 1. Read Prompt file
    // Assuming prompts are in projectRoot/prompts/
    const promptFilePath = path.resolve(process.cwd(), "prompts", stage.promptPath);
    let auditRuleContent = "";
    try {
        auditRuleContent = await readFile(promptFilePath, "utf-8");
    } catch (e) {
        throw new Error(`Failed to read prompt file ${stage.promptPath}: ${e}`);
    }

    // 2. Build Prompt
    const systemPrompt = `You are a Code Drift Analyzer. 
Your job is to compare the provided "Git Diff" (recent changes) against the "Audit Rule" provided.
Determine if the changes introduce any deviation, violation, or "drift" from the standard described in the Audit Rule.

Response Format: JSON only.
{
  "driftDetected": boolean,
  "argumentation": "string",
  "remediationPlan": "string (optional)"
}
`;

    const userPrompt = `
=== AUDIT RULE ===
${auditRuleContent}

=== GIT DIFF (CHANGES) ===
${diff.slice(0, 50000)} ${diff.length > 50000 ? "\n...(truncated)..." : ""}

=== INSTRUCTIONS ===
Analyze the diff strictly against the Audit Rule.
Does the code in the diff violate the standards or requirements in the Audit Rule?
`;

    // 3. Call LLM
    const model = await getChatModel(llmSelection, { temperature: 0 });
    const agent = createReactAgent({
        llm: model,
        tools: [], // Read-only analysis
        prompt: new SystemMessage(systemPrompt),
    });

    const response = await agent.invoke({ messages: [new HumanMessage(userPrompt)] });
    const lastMsg = response.messages[response.messages.length - 1];
    const content = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);

    // 4. Parse Output
    let parsed: any = { driftDetected: false, argumentation: "Failed to parse output" };
    try {
        const json = extractJsonObject(content);
        const res = DriftAnalysisSchema.safeParse(json);
        if (res.success) {
            parsed = res.data;
        } else {
            parsed = { driftDetected: false, argumentation: `Schema validation failed: ${res.error}` };
        }
    } catch (e) {
        parsed = { driftDetected: false, argumentation: `JSON parse failed: ${e}` };
    }

    return {
        stageId: stage.id,
        stageName: stage.name,
        promptPath: stage.promptPath,
        driftDetected: parsed.driftDetected,
        argumentation: parsed.argumentation,
        remediationPlan: parsed.remediationPlan,
        confidence: parsed.confidence,
        timestamp: now(),
    };
}

// --- Worker Logic ---

async function claimNextJob(lockId: string, opts: Required<DriftWorkerOptions>): Promise<DriftJobDoc | null> {
    const db = await getDb();
    const jobs = db.collection<DriftJobDoc>(JOBS_COLLECTION);
    const staleBefore = new Date(Date.now() - opts.lockTtlMs);

    // Recovery or new job
    const res = await jobs.findOneAndUpdate(
        {
            $or: [
                { status: "queued" },
                { status: "running", heartbeatAt: { $lt: staleBefore } }
            ]
        },
        {
            $set: {
                status: "running",
                lockId,
                lockedAt: now(),
                heartbeatAt: now(),
                startedAt: now(),
                error: undefined
            }
        } as any,
        { sort: { createdAt: 1 }, returnDocument: "after" }
    );
    // Different mongodb type packages disagree on return shape (value vs direct doc).
    const anyRes = res as any;
    const claimed = anyRes && typeof anyRes === "object" && "value" in anyRes ? ((anyRes.value as any) ?? null) : (anyRes ?? null);

    return claimed;
}

async function processJob(job: DriftJobDoc, lockId: string, opts: Required<DriftWorkerOptions>) {
    const db = await getDb();
    const jobs = db.collection<DriftJobDoc>(JOBS_COLLECTION);

    // Resolve LLM info if not set
    if (!job.resolvedLlm) {
        // Fix: Explicitly cast or construct Partial<LlmSelection> to satisfy type check
        const selection: Partial<LlmSelection> | undefined = job.llmSelection ? {
            provider: job.llmSelection.provider as any,
            model: job.llmSelection.model
        } : undefined;

        const resolved = await resolveResolvedLlmInfo(selection);
        await jobs.updateOne({ _id: job._id }, { $set: { resolvedLlm: resolved } });
        await appendLogLine(db, job._id, `Resolved LLM: ${resolved.provider}/${resolved.model}`);
    }

    // Get Stages (Full Audit)
    // We use the FULL_AUDIT preset as the "all prompts" list
    const preset = ChainConfigBuilder.PRESETS.FULL_AUDIT;
    if (!preset || !preset.stages) {
        throw new Error("FULL_AUDIT preset not found or empty");
    }
    const stages = preset.stages;

    // Get Diff Snapshot if not present
    let diff = job.diffSnapshot;
    if (!diff) {
        await appendLogLine(db, job._id, "Fetching git diff snapshot...");
        try {
            // 5. Instantiate McpClient
            const mcp = await McpClient.getInstance();
            const diffRaw = await mcp.callTool("git_diff", { filePath: undefined }); // root

            let diffData: any = diffRaw;
            if (typeof diffRaw === "string") {
                try {
                    diffData = JSON.parse(diffRaw);
                } catch (e) {
                    diffData = { diff: "" };
                }
            }

            diff = diffData?.diff || "";
            if (!diff) diff = "No changes detected.";

            await jobs.updateOne({ _id: job._id }, { $set: { diffSnapshot: diff } });
        } catch (e: any) {
            throw new Error(`Failed to fetch git diff: ${e.message}`);
        }
    }

    if (!diff || diff.trim().length === 0 || diff === "No changes detected.") {
        await appendLogLine(db, job._id, "No changes to analyze.");
        await jobs.updateOne({ _id: job._id }, { $set: { status: "success", finishedAt: now(), processedStages: stages.length } });
        return;
    }

    const total = stages.length;
    await jobs.updateOne({ _id: job._id }, { $set: { totalStages: total } });

    // Heartbeat loop
    const hbInterval = setInterval(async () => {
        await jobs.updateOne({ _id: job._id, lockId }, { $set: { heartbeatAt: now() } });
    }, opts.heartbeatIntervalMs);

    try {
        // Resume from currentStageIndex
        let currentIndex = job.currentStageIndex ?? 0;

        for (let i = currentIndex; i < total; i++) {
            // Check cancellation
            const fresh = await jobs.findOne({ _id: job._id });
            if (fresh?.status === "cancelled") {
                await appendLogLine(db, job._id, "Job cancelled.");
                return;
            }

            const stage = stages[i];
            await appendLogLine(db, job._id, `Analyzing stage ${i + 1}/${total}: ${stage.name} (${stage.promptPath})...`);

            try {
                // Fix: Cast llmSelection to Partial<LlmSelection>
                const selection: Partial<LlmSelection> | undefined = job.llmSelection ? {
                    provider: job.llmSelection.provider as any,
                    model: job.llmSelection.model
                } : undefined;

                const result = await analyzeStage(stage as any, diff!, selection);

                await jobs.updateOne(
                    { _id: job._id },
                    {
                        $push: { results: result },
                        $set: { currentStageIndex: i + 1, processedStages: i + 1 }
                    }
                );

                if (result.driftDetected) {
                    await appendLogLine(db, job._id, `⚠️ Drift DETECTED in ${stage.name}`);
                }

            } catch (e: any) {
                await appendLogLine(db, job._id, `Error in stage ${stage.name}: ${e.message}`);
                // We continue to next stage even if one fails
            }
        }

        await jobs.updateOne({ _id: job._id }, { $set: { status: "success", finishedAt: now() } });
        await appendLogLine(db, job._id, "Drift analysis completed.");

    } finally {
        clearInterval(hbInterval);
    }
}

export class DriftAnalysisWorker {
    private readonly lockId: string;
    private readonly opts: Required<DriftWorkerOptions>;
    private stopped = false;

    constructor(options?: DriftWorkerOptions) {
        this.lockId = `drift-worker-${process.pid}-${Math.random().toString(16).slice(2)}`;
        this.opts = { ...defaultOptions, ...(options ?? {}) };
    }

    async runOnce() {
        await ensureIndexes();
        const job = await claimNextJob(this.lockId, this.opts);
        if (!job) return false;

        try {
            await processJob(job, this.lockId, this.opts);
        } catch (e: any) {
            const db = await getDb();
            await appendLogLine(db, job._id, `Job failed: ${e.message}`);
            await db.collection(JOBS_COLLECTION).updateOne(
                { _id: job._id },
                { $set: { status: "error", error: e.message, finishedAt: now() } }
            );
        }
        return true;
    }

    async start() {
        this.stopped = false;
        while (!this.stopped) {
            const didWork = await this.runOnce();
            if (!didWork) {
                await new Promise(r => setTimeout(r, this.opts.pollIntervalMs));
            }
        }
    }

    stop() {
        this.stopped = true;
    }
}

// DRIFT TEST COMMENT

// DRIFT TEST 2
