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

  // ── Git operations ──────────────────────────────────────────────────────
  // All git operations accept an optional `cwd` (workspace path) parameter.
  // When provided, the main process uses it directly instead of the global
  // `currentWorkspacePath`. This guarantees the command runs against the
  // intended repo even if a workspace switch races with an in-flight IPC call.

  gitStatus: (cwd?: string): Promise<GitStatus> => ipcRenderer.invoke("git:status", cwd),
  gitCommit: (message: string, cwd?: string): Promise<string> => ipcRenderer.invoke("git:commit", message, cwd),
  gitCreateBranch: (branch: string, cwd?: string): Promise<void> => ipcRenderer.invoke("git:createBranch", branch, cwd),
  gitCheckout: (branch: string, cwd?: string): Promise<void> => ipcRenderer.invoke("git:checkout", branch, cwd),
  gitClone: (repoUrl: string, branch?: string): Promise<WorkspaceInfo> => ipcRenderer.invoke("git:clone", repoUrl, branch),
  gitListBranches: (cwd?: string): Promise<string[]> => ipcRenderer.invoke("git:listBranches", cwd),
  gitDiff: (filePath?: string, cwd?: string): Promise<string> => ipcRenderer.invoke("git:diff", filePath, cwd),
  gitDiffStaged: (filePath?: string, cwd?: string): Promise<string> => ipcRenderer.invoke("git:diffStaged", filePath, cwd),
  gitStageFile: (filePath: string, cwd?: string): Promise<void> => ipcRenderer.invoke("git:stageFile", filePath, cwd),
  gitStageAll: (cwd?: string): Promise<void> => ipcRenderer.invoke("git:stageAll", cwd),
  gitUnstageFile: (filePath: string, cwd?: string): Promise<void> => ipcRenderer.invoke("git:unstageFile", filePath, cwd),
  gitUnstageAll: (cwd?: string): Promise<void> => ipcRenderer.invoke("git:unstageAll", cwd),
  gitRevertFile: (filePath: string, cwd?: string): Promise<void> => ipcRenderer.invoke("git:revertFile", filePath, cwd),
  gitRevertAll: (cwd?: string): Promise<void> => ipcRenderer.invoke("git:revertAll", cwd),
  gitCommitStaged: (message: string, cwd?: string): Promise<string> => ipcRenderer.invoke("git:commitStaged", message, cwd),
  gitPush: (remote?: string, branch?: string, cwd?: string): Promise<string> => ipcRenderer.invoke("git:push", remote, branch, cwd),
  gitCreatePR: (title: string, body?: string, base?: string, cwd?: string): Promise<{ url: string; number: number }> => ipcRenderer.invoke("git:createPR", title, body, base, cwd),
  // Command Center
  pickFile: (): Promise<string[]> => ipcRenderer.invoke("app:pickFile"),
  captureScreenshot: (): Promise<string | null> => ipcRenderer.invoke("app:captureScreenshot"),
  popOutThread: (threadId: string, title: string): Promise<number> => ipcRenderer.invoke("app:popOutThread", { threadId, title }),
};

contextBridge.exposeInMainWorld("kletron", api);

export type KletronAPI = typeof api;
