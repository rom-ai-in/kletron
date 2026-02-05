import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  applyFileChange,
  getGitStatus,
  getWorkspaceInfo,
  gitCheckout,
  gitCloneRepo,
  gitCommitAll,
  gitCreateBranch,
  listFiles,
  readFile,
  writeFile
} from "@numezis/bridge";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = process.env.DESKTOP_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;
let currentWorkspacePath: string | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#09090b",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", () => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("app:selectWorkspace", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  currentWorkspacePath = result.filePaths[0];
  return getWorkspaceInfo(currentWorkspacePath);
});

ipcMain.handle("app:setWorkspace", async (_event, workspacePath: string) => {
  if (!workspacePath) return null;
  currentWorkspacePath = workspacePath;
  return getWorkspaceInfo(currentWorkspacePath);
});

ipcMain.handle("app:getWorkspace", async () => {
  if (!currentWorkspacePath) return null;
  return getWorkspaceInfo(currentWorkspacePath);
});

ipcMain.handle("app:openExternal", async (_event, url: string) => {
  if (!url) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("app:openInVSCode", async (_event, targetPath?: string) => {
  const resolved = targetPath || currentWorkspacePath;
  if (!resolved) return false;
  return new Promise((resolve) => {
    const child = spawn("open", ["-a", "Visual Studio Code", resolved], {
      stdio: "ignore"
    });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
});

ipcMain.handle("fs:listFiles", async (_event, relativePath?: string, depth?: number) => {
  if (!currentWorkspacePath) throw new Error("Workspace not set");
  return listFiles(currentWorkspacePath, relativePath ?? "", depth ?? 2);
});

ipcMain.handle("fs:readFile", async (_event, relativePath: string) => {
  if (!currentWorkspacePath) throw new Error("Workspace not set");
  return readFile(currentWorkspacePath, relativePath);
});

ipcMain.handle("fs:writeFile", async (_event, relativePath: string, content: string) => {
  if (!currentWorkspacePath) throw new Error("Workspace not set");
  return writeFile(currentWorkspacePath, relativePath, content);
});

ipcMain.handle("fs:applyFileChange", async (_event, relativePath: string, content: string) => {
  if (!currentWorkspacePath) throw new Error("Workspace not set");
  return applyFileChange(currentWorkspacePath, relativePath, content);
});

ipcMain.handle("git:status", async () => {
  if (!currentWorkspacePath) throw new Error("Workspace not set");
  return getGitStatus(currentWorkspacePath);
});

ipcMain.handle("git:commit", async (_event, message: string) => {
  if (!currentWorkspacePath) throw new Error("Workspace not set");
  return gitCommitAll(currentWorkspacePath, message);
});

ipcMain.handle("git:createBranch", async (_event, branch: string) => {
  if (!currentWorkspacePath) throw new Error("Workspace not set");
  return gitCreateBranch(currentWorkspacePath, branch);
});

ipcMain.handle("git:checkout", async (_event, branch: string) => {
  if (!currentWorkspacePath) throw new Error("Workspace not set");
  return gitCheckout(currentWorkspacePath, branch);
});

ipcMain.handle("git:clone", async (_event, repoUrl: string, branch?: string) => {
  const result = await gitCloneRepo(repoUrl, undefined, branch);
  currentWorkspacePath = result.repoPath;
  return result.workspace;
});
