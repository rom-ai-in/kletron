import { contextBridge, ipcRenderer } from "electron";

export type WorkspaceInfo = { path: string; name: string };
export type FileEntry = { path: string; name: string; isDirectory: boolean };
export type GitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
};

const api = {
  selectWorkspace: (): Promise<WorkspaceInfo | null> => ipcRenderer.invoke("app:selectWorkspace"),
  setWorkspace: (workspacePath: string): Promise<WorkspaceInfo | null> => ipcRenderer.invoke("app:setWorkspace", workspacePath),
  getWorkspace: (): Promise<WorkspaceInfo | null> => ipcRenderer.invoke("app:getWorkspace"),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("app:openExternal", url),
  openInVSCode: (targetPath?: string): Promise<boolean> => ipcRenderer.invoke("app:openInVSCode", targetPath),
  listFiles: (relativePath?: string, depth?: number): Promise<FileEntry[]> => ipcRenderer.invoke("fs:listFiles", relativePath, depth),
  readFile: (relativePath: string): Promise<string> => ipcRenderer.invoke("fs:readFile", relativePath),
  writeFile: (relativePath: string, content: string): Promise<void> => ipcRenderer.invoke("fs:writeFile", relativePath, content),
  applyFileChange: (relativePath: string, content: string): Promise<void> => ipcRenderer.invoke("fs:applyFileChange", relativePath, content),
  gitStatus: (): Promise<GitStatus> => ipcRenderer.invoke("git:status"),
  gitCommit: (message: string): Promise<string> => ipcRenderer.invoke("git:commit", message),
  gitCreateBranch: (branch: string): Promise<void> => ipcRenderer.invoke("git:createBranch", branch),
  gitCheckout: (branch: string): Promise<void> => ipcRenderer.invoke("git:checkout", branch),
  gitClone: (repoUrl: string, branch?: string): Promise<WorkspaceInfo> => ipcRenderer.invoke("git:clone", repoUrl, branch)
};

contextBridge.exposeInMainWorld("numezis", api);

export type NumezisAPI = typeof api;
