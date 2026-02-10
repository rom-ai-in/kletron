import { contextBridge, ipcRenderer } from "electron";

export type WorkspaceInfo = { path: string; name: string };
export type FileEntry = { path: string; name: string; isDirectory: boolean };
export type GitFileChange = {
  path: string;
  status: 'modified' | 'created' | 'deleted' | 'renamed' | 'untracked';
  from?: string;
};

export type GitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
};

export type UpdateStatus = {
  state:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error"
    | "disabled";
  message?: string;
  version?: string;
  progress?: number;
  error?: string;
  releaseNotes?: string;
};

const api = {
  selectWorkspace: (): Promise<WorkspaceInfo | null> => ipcRenderer.invoke("app:selectWorkspace"),
  setWorkspace: (workspacePath: string): Promise<WorkspaceInfo | null> => ipcRenderer.invoke("app:setWorkspace", workspacePath),
  getWorkspace: (): Promise<WorkspaceInfo | null> => ipcRenderer.invoke("app:getWorkspace"),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("app:openExternal", url),
  openInVSCode: (targetPath?: string): Promise<boolean> => ipcRenderer.invoke("app:openInVSCode", targetPath),
  onAuthLink: (handler: (url: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => handler(url);
    ipcRenderer.on("auth:deepLink", listener);
    return () => ipcRenderer.removeListener("auth:deepLink", listener);
  },
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke("app:getUpdateStatus"),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke("app:checkForUpdates"),
  restartToUpdate: (): Promise<boolean> => ipcRenderer.invoke("app:restartToUpdate"),
  onUpdateStatus: (handler: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => handler(status);
    ipcRenderer.on("updates:status", listener);
    return () => ipcRenderer.removeListener("updates:status", listener);
  },
  listFiles: (relativePath?: string, depth?: number): Promise<FileEntry[]> => ipcRenderer.invoke("fs:listFiles", relativePath, depth),
  readFile: (relativePath: string): Promise<string> => ipcRenderer.invoke("fs:readFile", relativePath),
  writeFile: (relativePath: string, content: string): Promise<void> => ipcRenderer.invoke("fs:writeFile", relativePath, content),
  applyFileChange: (relativePath: string, content: string): Promise<void> => ipcRenderer.invoke("fs:applyFileChange", relativePath, content),
  gitStatus: (): Promise<GitStatus> => ipcRenderer.invoke("git:status"),
  gitCommit: (message: string): Promise<string> => ipcRenderer.invoke("git:commit", message),
  gitCreateBranch: (branch: string): Promise<void> => ipcRenderer.invoke("git:createBranch", branch),
  gitCheckout: (branch: string): Promise<void> => ipcRenderer.invoke("git:checkout", branch),
  gitClone: (repoUrl: string, branch?: string): Promise<WorkspaceInfo> => ipcRenderer.invoke("git:clone", repoUrl, branch),
  gitListBranches: (): Promise<string[]> => ipcRenderer.invoke("git:listBranches"),
  gitDiff: (filePath?: string): Promise<string> => ipcRenderer.invoke("git:diff", filePath),
  gitDiffStaged: (filePath?: string): Promise<string> => ipcRenderer.invoke("git:diffStaged", filePath),
  gitStageFile: (filePath: string): Promise<void> => ipcRenderer.invoke("git:stageFile", filePath),
  gitStageAll: (): Promise<void> => ipcRenderer.invoke("git:stageAll"),
  gitUnstageFile: (filePath: string): Promise<void> => ipcRenderer.invoke("git:unstageFile", filePath),
  gitUnstageAll: (): Promise<void> => ipcRenderer.invoke("git:unstageAll"),
  gitRevertFile: (filePath: string): Promise<void> => ipcRenderer.invoke("git:revertFile", filePath),
  gitRevertAll: (): Promise<void> => ipcRenderer.invoke("git:revertAll"),
  gitCommitStaged: (message: string): Promise<string> => ipcRenderer.invoke("git:commitStaged", message),
  gitPush: (remote?: string, branch?: string): Promise<string> => ipcRenderer.invoke("git:push", remote, branch),
  gitCreatePR: (title: string, body?: string, base?: string): Promise<{ url: string; number: number }> => ipcRenderer.invoke("git:createPR", title, body, base),
  // Command Center
  pickFile: (): Promise<string[]> => ipcRenderer.invoke("app:pickFile"),
  captureScreenshot: (): Promise<string | null> => ipcRenderer.invoke("app:captureScreenshot"),
  popOutThread: (threadId: string, title: string): Promise<number> => ipcRenderer.invoke("app:popOutThread", { threadId, title }),
};

contextBridge.exposeInMainWorld("numezis", api);

export type NumezisAPI = typeof api;
