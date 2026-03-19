import { AsyncLocalStorage } from "node:async_hooks";
import type { Workspace } from "../services/workspaceService";

export type WorkspaceContext = {
  workspaceId: string;
  rootPath: string;
  workspace: Workspace;
};

const storage = new AsyncLocalStorage<WorkspaceContext>();

export function getWorkspaceContext(): WorkspaceContext | null {
  return storage.getStore() ?? null;
}

export function runWithWorkspaceContext<T>(
  workspace: Workspace,
  fn: () => Promise<T> | T
): Promise<T> | T {
  // Ensure MCP config.json allowlist contains this workspace root before
  // any downstream tool calls.  Lazy import to avoid circular deps.
  try {
    const { ensureWorkspaceInConfigJson } = require("../services/workspaceService");
    ensureWorkspaceInConfigJson(workspace.rootPath);
  } catch {
    // Non-fatal: module may not be available in all contexts
  }

  const workspaceId = workspace._id?.toString() ?? "";
  return storage.run(
    {
      workspaceId,
      rootPath: workspace.rootPath,
      workspace,
    },
    fn
  );
}
