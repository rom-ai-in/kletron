// Lightweight audit log for agent-driven product mutations (Kletron admin
// tools). Records who did what, when, and how, so destructive actions taken
// by an LLM can always be reviewed and rolled back.
//
// Failure-tolerant: if Mongo is unreachable we still log to stderr and
// continue. The caller should never block on audit.

import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";

const COLLECTION_NAME = "agent_audit";

export type AgentAuditOutcome = "success" | "error";

export interface AgentAuditLogInput {
    /** Run id (string form). */
    runId?: string;
    /** Workspace id (string form). */
    workspaceId?: string;
    /** User id the action was performed on behalf of. */
    userId?: string;
    /** Tool name, e.g. `kletron_create_graph`. */
    tool: string;
    /** JSON-serialisable payload (will be truncated if oversized). */
    args?: unknown;
    /** Result snippet (will be truncated). */
    result?: unknown;
    /** Captured when outcome === "error". */
    error?: string;
    outcome: AgentAuditOutcome;
}

const MAX_PAYLOAD_CHARS = 8_000;

function truncate(value: unknown): unknown {
    if (value == null) return value;
    let str: string;
    try {
        str = typeof value === "string" ? value : JSON.stringify(value);
    } catch {
        str = String(value);
    }
    if (str.length <= MAX_PAYLOAD_CHARS) return value;
    return `${str.slice(0, MAX_PAYLOAD_CHARS)}…[truncated ${str.length - MAX_PAYLOAD_CHARS}]`;
}

export const agentAuditService = {
    async log(input: AgentAuditLogInput): Promise<void> {
        const doc = {
            tool: input.tool,
            outcome: input.outcome,
            args: truncate(input.args),
            result: truncate(input.result),
            error: input.error,
            userId: input.userId,
            workspaceId:
                input.workspaceId && ObjectId.isValid(input.workspaceId)
                    ? new ObjectId(input.workspaceId)
                    : input.workspaceId,
            runId:
                input.runId && ObjectId.isValid(input.runId)
                    ? new ObjectId(input.runId)
                    : input.runId,
            createdAt: new Date(),
        };
        try {
            const db = await getDb();
            await db.collection(COLLECTION_NAME).insertOne(doc as any);
        } catch (error) {
            console.warn(
                `[agentAudit] Mongo log failed for tool=${input.tool}:`,
                (error as Error)?.message ?? error,
                "payload:",
                JSON.stringify({
                    tool: input.tool,
                    outcome: input.outcome,
                    userId: input.userId,
                    workspaceId: input.workspaceId,
                    runId: input.runId,
                    error: input.error,
                })
            );
        }
    },
};
