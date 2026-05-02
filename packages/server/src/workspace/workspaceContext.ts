import { AsyncLocalStorage } from "node:async_hooks";
import type { Workspace } from "../services/workspaceService";

export type WorkspaceContext = {
  workspaceId: string;
  rootPath: string;
  workspace: Workspace;
  /** Identity of the user this run is acting on behalf of. */
  userId?: string;
  /** Run id, when running inside an agent run. */
  runId?: string;
};

const storage = new AsyncLocalStorage<WorkspaceContext>();

export function getWorkspaceContext(): WorkspaceContext | null {
  return storage.getStore() ?? null;
}

export function runWithWorkspaceContext<T>(
  workspace: Workspace,
  fn: () => Promise<T> | T,
  identity?: { userId?: string; runId?: string }
): Promise<T> | T {
  const workspaceId = workspace._id?.toString() ?? "";
  return storage.run(
    {
      workspaceId,
      rootPath: workspace.rootPath,
      workspace,
      userId: identity?.userId,
      runId: identity?.runId,
    },
    fn
  );
}
