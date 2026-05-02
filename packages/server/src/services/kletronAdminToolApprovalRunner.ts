// Execute Kletron admin tools from HTTP approval routes (human-in-the-loop).
// The agent runtime normally runs these with `runWithWorkspaceContext` + userId;
// when the user clicks Approve in the UI, we replay the same tool with the
// authenticated user id so audit logs and permission checks stay consistent.

import { kletronAdminTools } from "@kletron/agent-core/tools/kletronAdminTools";
import { runWithWorkspaceContext } from "@kletron/server/workspace/workspaceContext";
import type { Workspace } from "./workspaceService";

export function isKletronAdminToolName(toolName: string): boolean {
    return typeof toolName === "string" && toolName.startsWith("kletron_");
}

export async function invokeKletronAdminToolForApproval(opts: {
    toolName: string;
    args: Record<string, unknown>;
    workspace: Workspace;
    userId: string;
    runId: string;
}): Promise<string> {
    const tool = kletronAdminTools.find(
        (t: { name?: string }) => t.name === opts.toolName
    ) as { invoke: (input: Record<string, unknown>) => Promise<string> } | undefined;
    if (!tool || typeof tool.invoke !== "function") {
        throw new Error(`Unknown Kletron admin tool: ${opts.toolName}`);
    }
    return runWithWorkspaceContext(
        opts.workspace,
        async () => tool.invoke(opts.args ?? {}),
        { userId: opts.userId, runId: opts.runId }
    );
}
