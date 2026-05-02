import { getWorkspaceContext } from "@kletron/server/workspace/workspaceContext";
import { agentAuditService } from "@kletron/server/services/agentAuditService";

export interface KletronRunIdentity {
    userId: string;
    workspaceId: string;
    runId?: string;
}

export function requireRunIdentity(): KletronRunIdentity {
    const ctx = getWorkspaceContext();
    if (!ctx) {
        throw new Error(
            "Kletron admin tools require an active workspace context. Are you running outside an agent run?"
        );
    }
    if (!ctx.workspaceId) {
        throw new Error("Workspace id missing from run context.");
    }
    if (!ctx.userId) {
        throw new Error(
            "User identity missing from run context. Refusing to perform admin action without an attributable user."
        );
    }
    return {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        runId: ctx.runId,
    };
}

export async function withAudit<T>(tool: string, args: unknown, fn: () => Promise<T>): Promise<T> {
    const identity = requireRunIdentity();
    try {
        const result = await fn();
        agentAuditService
            .log({
                tool,
                args,
                result,
                outcome: "success",
                userId: identity.userId,
                workspaceId: identity.workspaceId,
                runId: identity.runId,
            })
            .catch(() => undefined);
        return result;
    } catch (error) {
        agentAuditService
            .log({
                tool,
                args,
                error: (error as Error)?.message ?? String(error),
                outcome: "error",
                userId: identity.userId,
                workspaceId: identity.workspaceId,
                runId: identity.runId,
            })
            .catch(() => undefined);
        throw error;
    }
}

export function asJson(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return JSON.stringify(String(value));
    }
}
