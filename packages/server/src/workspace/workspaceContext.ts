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
