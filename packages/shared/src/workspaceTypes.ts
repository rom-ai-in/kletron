export type WorkspaceStatus = "active" | "archived";

export interface WorkspaceSummary {
  id: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  provider?: string;
  defaultBranch?: string;
  status?: WorkspaceStatus;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  lastUsed?: string | Date;
}

export interface WorkspacesResponse {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId?: string;
}

export interface WorkspaceResponse {
  workspace: WorkspaceSummary | null;
  activeWorkspaceId?: string;
}
