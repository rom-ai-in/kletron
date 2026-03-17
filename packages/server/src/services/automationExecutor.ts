import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";
import { getDb } from "../lib/db";
import { runWorkflow } from "@kletron/agent-core/workflows";
import { AgentWorkflowAbortError } from "@kletron/agent-core/reactAgentRunner";
import { auditService } from "./auditService";
import { getWorkspaceByIdUnsafe, listAllWorkspaces } from "./workspaceService";
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
} from "@kletron/shared/automationTypes";
import type { AgentWorkflowAbortReason } from "@kletron/shared/types";
import type { Claim as WorkflowClaim, Task as WorkflowTask, AgentWorkflowResult, AgentEvent } from "@kletron/shared/types";
import { computeNextRun } from "@kletron/shared/cronUtils";

const COLLECTION_NAME = "audit_chains"; // Legacy collection name - kept for backward compatibility
const RUNS_COLLECTION = "audit_runs"; // Legacy collection name - kept for backward compatibility

/**
 * Parse findings from a markdown/text report produced by a conversational agent.
 * Handles multiple LLM output formats:
 *   Format A: "### 1) Title\n**Severity:** BLOQUANT\n**Where:** ..."
 *   Format B: "1) **BLOQUANT — Title**\n- **Files** ..."
 *   Format C: "### Finding 1: Title\n**Severity:** WARNING"
 */
function parseFindingsFromText(
    report: string,
    chainId: string,
    stageId: string,
    sessionId: string,
): Finding[] {
    if (!report || report.length < 50) return [];

    // Unwrap JSON wrapper: { "simple_react": { "response": "..." } }
    let text = report;
    try {
        const parsed = JSON.parse(report);
        const inner = parsed?.simple_react?.response ?? parsed?.response;
        if (typeof inner === "string") text = inner;
    } catch { /* not JSON, use as-is */ }

    // Split on numbered items: "### 1)", "1)", "### Finding 1:", etc.
    // Each section runs until the next numbered item or end-of-string.
    const sectionPattern = /(?:^|\n)(?:#{1,4}\s+)?(?:Finding\s+)?\d+[.):][\s\S]*?(?=\n(?:#{1,4}\s+)?(?:Finding\s+)?\d+[.):]|$)/g;
    const sections = text.match(sectionPattern);
    if (!sections || sections.length === 0) {
        console.info(`[parseFindingsFromText] No numbered sections found in ${text.length}-char report`);
        return [];
    }

    console.info(`[parseFindingsFromText] Found ${sections.length} candidate sections in ${text.length}-char report`);

    const findings: Finding[] = [];
    const severityWords = /\b(BLOQUANT|CRITICAL|WARNING|INFO|HIGH|MEDIUM|LOW)\b/i;

    for (const section of sections) {
        const firstLine = section.trim().split("\n")[0] ?? "";
        const titleClean = firstLine
            .replace(/^#{1,4}\s*/, "")
            .replace(/^(?:Finding\s+)?\d+[.):\s]+/, "")
            .replace(/\*\*/g, "")
            .trim();
        if (!titleClean) continue;

        // Severity: "**Severity:** **BLOQUANT**" or inline "**BLOQUANT —"
        let type: "BLOQUANT" | "WARNING" | "INFO" = "INFO";
        const sevLabelMatch = section.match(/\*\*Severity:?\*\*[:\s]*\*?\*?(BLOQUANT|CRITICAL|WARNING|INFO|HIGH|MEDIUM|LOW)\*?\*?/i);
        const sevInlineMatch = firstLine.match(severityWords);
        const sevRaw = (sevLabelMatch?.[1] ?? sevInlineMatch?.[1] ?? "").toUpperCase();
        if (sevRaw === "BLOQUANT" || sevRaw === "CRITICAL" || sevRaw === "HIGH") type = "BLOQUANT";
        else if (sevRaw === "WARNING" || sevRaw === "MEDIUM") type = "WARNING";

        // File paths: backtick-quoted containing / or .
        const filePaths = section.match(/`([a-zA-Z0-9_.@/-]+\.[a-zA-Z0-9]{1,6})`/g)
            ?.map(m => m.replace(/`/g, "")) ?? [];
        const file = filePaths[0] ?? "unknown";

        // Line numbers: "**~357-377**", "~lines 96-105", "line 42", "L206-302"
        const lineMatch = section.match(/\*?\*?~?\s*(?:lines?\s*)?(\d+)\s*[-–]\s*(\d+)\s*\*?\*?/)
            ?? section.match(/\*?\*?~?\s*lines?\s+(\d+)\s*\*?\*?/i)
            ?? section.match(/\bL(\d+)(?:\s*[-–]\s*(\d+))?/);
        const lineStart = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
        const lineEnd = lineMatch?.[2] ? parseInt(lineMatch[2], 10) : undefined;

        // Description: prefer "**Description:**" block, then "What's wrong", then title only
        const descBlock = section.match(/\*\*Description:?\*\*\s*([\s\S]*?)(?=\n-\s*\*\*(?:Concrete|Suggested) fix|$)/i);
        const whatWrong = section.match(/\*\*What'?s wrong\*\*\s*\n([\s\S]*?)(?=\n\*\*(?:Concrete|Suggested) fix|$)/i);
        const detail = descBlock?.[1]?.trim() ?? whatWrong?.[1]?.trim() ?? "";
        const cleanDetail = detail.replace(/\*\*/g, "").replace(/```[\s\S]*?```/g, "[code]").trim();
        const desc = cleanDetail
            ? `${titleClean}: ${cleanDetail.slice(0, 300)}`
            : titleClean;

        findings.push({
            chainId,
            stageId,
            sessionId,
            type,
            file,
            description: desc,
            lineStart,
            lineEnd,
            timestamp: new Date(),
        });
    }

    console.info(`[parseFindingsFromText] Extracted ${findings.length} findings`);
    return findings;
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

function detectToolExecutionBlockers(workflowResult: AgentWorkflowResult, reportText: string): string | null {
    const directBlockers = [
        /resolved path is outside of the configured repository directories/i,
        /configured path does not exist or is not a directory/i,
        /tools are blocked/i,
        /cannot perform the analysis due to environment restrictions/i,
    ];
    if (directBlockers.some((re) => re.test(reportText))) {
        return "Tool execution is blocked by workspace/path restrictions";
    }

    const events = Array.isArray((workflowResult as any)?.eventStream)
        ? ((workflowResult as any).eventStream as Array<Record<string, unknown>>)
        : [];
    const toolEvents = events.filter((e) => e?.kind === "tool");
    if (!toolEvents.length) return null;

    const toolErrors = toolEvents.filter((e) => {
        const content = typeof e?.content === "string" ? e.content : "";
        return /^error:/i.test(content.trim()) || /please fix your mistakes/i.test(content);
    });
    if (!toolErrors.length) return null;

    const hasPathBlock = toolErrors.some((e) => {
        const content = typeof e?.content === "string" ? e.content : "";
        return directBlockers.some((re) => re.test(content));
    });
    if (hasPathBlock) {
        return "Tool execution failed because repository paths are not accessible";
    }

    // If most tool calls errored, stage output is not reliable.
    if (toolErrors.length >= 3 && toolErrors.length / toolEvents.length >= 0.7) {
        return "Most tool calls failed during the audit stage";
    }

    return null;
}

function parseJsonObject(raw?: string): Record<string, unknown> | null {
    if (!raw || typeof raw !== "string") return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function collectAuditEvidence(workflowResult: AgentWorkflowResult) {
    const events = Array.isArray(workflowResult.eventStream)
        ? (workflowResult.eventStream as AgentEvent[])
        : [];
    const toolEvents = events.filter((e) => e.kind === "tool");

    let fileReadOps = 0;
    let searchOps = 0;
    let structureOps = 0;
    let toolErrors = 0;
    const toolsUsed = new Set<string>();
    const filesRead = new Set<string>();

    for (const event of toolEvents) {
        const toolName = String(event.toolName || event.name || "").trim();
        if (!toolName) continue;
        toolsUsed.add(toolName);

        const lower = toolName.toLowerCase();
        if (/^error:/i.test((event.content || "").trim()) || /please fix your mistakes/i.test(event.content || "")) {
            toolErrors += 1;
        }

        if (lower === "read_file" || lower === "read_file_range") {
            fileReadOps += 1;
            const args = parseJsonObject(event.toolArgs);
            const filePath = typeof args?.filePath === "string"
                ? args.filePath
                : typeof args?.path === "string"
                    ? args.path
                    : "";
            if (filePath) filesRead.add(filePath);
        }

        if (
            lower === "search_code" ||
            lower === "semantic_code_search" ||
            lower === "git_grep" ||
            lower === "structural_search" ||
            lower === "symbols_list" ||
            lower === "find_symbol"
        ) {
            searchOps += 1;
        }

        if (lower === "list_files" || lower === "describe_structure" || lower === "repo_metrics") {
            structureOps += 1;
        }
    }

    return {
        toolCalls: toolEvents.length,
        toolErrors,
        fileReadOps,
        filesReadUnique: filesRead.size,
        searchOps,
        structureOps,
        toolsUsed: Array.from(toolsUsed),
    };
}

function evaluateZeroFindingEvidenceGate(params: {
    findingsCount: number;
    claimsCount: number;
    tasksCount: number;
    workflowResult: AgentWorkflowResult;
}): string | null {
    if (params.findingsCount > 0) return null;

    const evidence = collectAuditEvidence(params.workflowResult);
    const checks = [
        evidence.toolCalls >= 8,
        evidence.structureOps >= 1,
        evidence.searchOps >= 2,
        evidence.fileReadOps >= 3 || evidence.filesReadUnique >= 3,
        evidence.toolErrors <= Math.floor(Math.max(evidence.toolCalls, 1) * 0.4),
    ];

    const hasReasonableSubstance = params.claimsCount >= 3 || params.tasksCount >= 2;
    const passed = checks.every(Boolean) && hasReasonableSubstance;
    if (passed) return null;

    return [
        "Insufficient audit evidence for a zero-findings conclusion.",
        `toolCalls=${evidence.toolCalls}`,
        `toolErrors=${evidence.toolErrors}`,
        `structureOps=${evidence.structureOps}`,
        `searchOps=${evidence.searchOps}`,
        `fileReadOps=${evidence.fileReadOps}`,
        `filesReadUnique=${evidence.filesReadUnique}`,
        `claims=${params.claimsCount}`,
        `tasks=${params.tasksCount}`,
    ].join(" ");
}

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
            // Match workspace-scoped OR global automations (no workspaceId)
            query.$or = [
                { workspaceId: workspaceObjectId },
                { workspaceId: { $exists: false } },
            ];
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
            // Include workspace-scoped automations AND global ones (no workspaceId)
            query.$and = [
                ...(query.$and || []),
                { $or: [
                    { workspaceId: workspaceObjectId },
                    { workspaceId: { $exists: false } },
                ] },
            ];
        }

        if (filter?.status) {
            query.status = filter.status;
        }

        if (filter?.search) {
            query.$and = [
                ...(query.$and || []),
                { $or: [
                    { name: { $regex: filter.search, $options: "i" } },
                    { description: { $regex: filter.search, $options: "i" } },
                ] },
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

        // Resolve workspace root path for prompt injection
        let workspaceRootPath: string | undefined;
        try {
            const workspace = runWorkspaceId
                ? await getWorkspaceByIdUnsafe(runWorkspaceId)
                : (await listAllWorkspaces())[0];
            workspaceRootPath = workspace?.rootPath;
        } catch {
            // Non-fatal: prompts will just lack the workspace path
        }

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
            const userPrompt = this.buildUserPrompt(stage, context, workspaceRootPath);
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
                // Convert raw errors to a failed StageResult instead of aborting the pipeline
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`[AutomationExecutor] Stage ${stage.id} (${stage.name}) threw an error:`, errorMsg);
                stageResult = {
                    stageId: stage.id,
                    stageName: stage.name,
                    sessionId: "",
                    success: false,
                    findings: [],
                    claims: [],
                    tasks: [],
                    duration: Date.now() - startTime,
                    error: errorMsg,
                };
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

            // Handle failures — continue to next stage (stages are independent)
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
                    // Log failure but CONTINUE to the next stage (don't abort the pipeline)
                    console.warn(`[AutomationExecutor] Stage ${stage.id} failed: ${stageResult.error}. Continuing to next stage...`);
                }
            }
        }

        // Check for any stage failures
        const failedStages = results.filter((r) => !r.success);
        const hasFailures = failedStages.length > 0;

        // Aggregate results
        const aggregation = await this.aggregateResults(chain._id!.toString(), results);

        const totalDuration = Date.now() - startTime;

        // Determine final status — COMPLETED if all stages passed, FAILED if any failed
        const finalStatus: AutomationStatus = hasFailures ? "FAILED" : "COMPLETED";
        const failureInfo = hasFailures
            ? { failedStages: failedStages.map((r) => ({ stageId: r.stageId, stageName: r.stageName, error: r.error })) }
            : {};

        // Update final run state — always persist results regardless of failures
        await this.updateRunStatus(runId, finalStatus, {
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
        await this.updateAutomationStatus(chain._id!.toString(), finalStatus, undefined, run.workspaceId?.toString());

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
                source: "automation",
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

            // Extract findings from structured output first, fall back to parsing text
            let findings: Finding[] = (workflowResult.outputs?.findings || []).map(
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

            // If no structured findings, parse them from the text report
            if (findings.length === 0) {
                const rawReport = workflowResult.outputs?.report ?? workflowResult.conclusion ?? "";
                const reportText = typeof rawReport === "string" ? rawReport : (rawReport.markdown ?? rawReport.summary ?? JSON.stringify(rawReport));
                console.info(`[AutomationExecutor] No structured findings; parsing from ${reportText.length}-char report text`);
                findings = parseFindingsFromText(reportText, chainId, stage.id, sessionIdForLogs);
                console.info(`[AutomationExecutor] Parsed ${findings.length} findings from text`);
            }

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

            const rawReportOutput = workflowResult.outputs?.report ?? workflowResult.conclusion ?? "";
            const rawOutput = extractRawReportText(rawReportOutput);
            const blockerReason = detectToolExecutionBlockers(workflowResult, rawOutput);
            if (blockerReason) {
                return {
                    stageId: stage.id,
                    stageName: stage.name,
                    sessionId: sessionIdForLogs,
                    success: false,
                    error: blockerReason,
                    findings: [],
                    claims,
                    tasks,
                    rawOutput,
                    duration: Date.now() - startTime,
                };
            }

            const evidenceGateError = evaluateZeroFindingEvidenceGate({
                findingsCount: findings.length,
                claimsCount: claims.length,
                tasksCount: tasks.length,
                workflowResult,
            });
            if (evidenceGateError) {
                return {
                    stageId: stage.id,
                    stageName: stage.name,
                    sessionId: sessionIdForLogs,
                    success: false,
                    error: evidenceGateError,
                    findings: [],
                    claims,
                    tasks,
                    rawOutput,
                    duration: Date.now() - startTime,
                };
            }

            return {
                stageId: stage.id,
                stageName: stage.name,
                sessionId: sessionIdForLogs,
                success: true,
                findings,
                claims,
                tasks,
                rawOutput,
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
     * Build context from previous stages.
     * When a referenced field (e.g. "findings") is an empty array and the stage
     * has a rawOutput, inject the rawOutput so the next stage still gets useful context.
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

            if (!prevResult) continue;

            const value = field in prevResult ? (prevResult as any)[field] : undefined;
            const isEmpty = Array.isArray(value) ? value.length === 0 : !value;

            if (!isEmpty) {
                context[selector] = value;
            } else if (prevResult.rawOutput) {
                context[`${stageId}.output`] = prevResult.rawOutput;
            }
        }

        return Object.keys(context).length > 0 ? context : null;
    }

    /**
     * Build user prompt with context.
     * Wraps the stage prompt with instructions that force thorough, iterative analysis.
     */
    private buildUserPrompt(stage: AutomationStageConfig, context: any, workspaceRootPath?: string): string {
        const basePrompt = stage.prompt?.trim();
        if (!basePrompt) {
            throw new Error(`Stage ${stage.id} has an empty prompt`);
        }

        const parts: string[] = [];

        // Inject workspace targeting so the agent knows which project to operate on
        if (workspaceRootPath) {
            parts.push("## TARGET WORKSPACE");
            parts.push(`You are auditing the project located at: ${workspaceRootPath}`);
            parts.push(`All file paths in this task are relative to this root directory.`);
            parts.push(`When using tools like list_files, read_file, search_code, execute_bash, etc., always target this directory.`);
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

        parts.push("");
        parts.push("## EXECUTION INSTRUCTIONS");
        parts.push([
            "You MUST perform a thorough, multi-step analysis. Do NOT stop after one tool call.",
            ...(workspaceRootPath ? [`IMPORTANT: All operations MUST target the project at ${workspaceRootPath}. Do NOT explore or reference other directories.`] : []),
            "1. Start by listing the project structure (describe_structure or list_files).",
            "2. Identify the files most relevant to this audit stage.",
            "3. Read at least 5-10 key source files using read_file or read_file_range.",
            "4. Use search_code to find specific patterns, anti-patterns, or keywords related to the audit.",
            "5. For each issue found, note the exact file path, line numbers, severity (BLOQUANT/WARNING/INFO), and a concrete fix.",
            "6. After thorough investigation, produce a detailed report with ALL findings.",
            "",
            "Your final output MUST include:",
            "- A summary of what was analyzed",
            "- A numbered list of findings with file paths, line numbers, severity, description, and fix",
            "- If no issues are found after thorough analysis, explain what was checked and why it's clean",
            "- If findings count is 0, include an explicit 'Audit Evidence' section listing tools used and files inspected",
            "",
            "Mandatory scope hygiene:",
            "- Exclude noise directories: venv, .venv, node_modules, __pycache__, site-packages, build, dist, .git",
            "- Focus on project source/config/tests first",
            "",
            "Do NOT give up after a single tool call. Iterate until you have examined the codebase in depth.",
        ].join("\n"));

        return parts.join("\n");
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
            if (!result.success && result.error) {
                lines.push(`   - Error: ${result.error}`);
            }
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

        if (allFindings.length > 0) {
            lines.push("## Detailed Findings");
            lines.push("");
            allFindings.forEach((f, i) => {
                const loc = f.lineStart
                    ? `L${f.lineStart}${f.lineEnd ? `-${f.lineEnd}` : ""}`
                    : "";
                lines.push(`${i + 1}. **[${f.type}]** \`${f.file}\`${loc ? ` ${loc}` : ""}`);
                lines.push(`   ${f.description.slice(0, 500)}`);
                lines.push("");
            });
        }

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

    /**
     * Ensure that default feature audit automations exist in the database.
     * Seeds one automation per domain from the AUDITABLE_FEATURES list.
     * Safe to call multiple times — skips if already exists by name.
     *
     * @param workspaceId - Optional workspace to scope the seeded automation
     */
    async ensureDefaultAutomations(workspaceId?: string): Promise<{ created: string[]; skipped: string[] }> {
        const { AutomationConfigBuilder } = await import("@kletron/shared/automationConfigBuilder");
        const db = await getDb();

        const config = AutomationConfigBuilder.buildFullFeatureAudit();
        if (!config.name || !config.stages?.length) {
            return { created: [], skipped: [] };
        }

        // Direct name equality check (avoids regex issues with special chars)
        const query: Record<string, unknown> = { name: config.name };
        if (workspaceId) {
            const wid = toObjectId(workspaceId);
            if (wid) query.workspaceId = wid;
        }
        const existing = await db.collection(COLLECTION_NAME).findOne(query);

        if (existing) {
            console.info(`[AutomationExecutor] Skipped (already exists): ${config.name} — ${config.stages.length} stages`);
            return { created: [], skipped: [config.name] };
        }

        const id = await this.createAutomation({
            ...config,
            name: config.name,
            description: config.description ?? "",
            stages: config.stages,
            triggerType: "manual",
            ...(workspaceId ? { workspaceId } : {}),
        } as any);

        console.info(`[AutomationExecutor] Seeded automation: ${config.name} — ${config.stages.length} stages (${id})`);
        return { created: [config.name], skipped: [] };
    }
}

// Export singleton instance
export const automationExecutor = new AutomationExecutor();
