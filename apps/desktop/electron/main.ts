import { app, BrowserWindow, dialog, ipcMain, shell, nativeImage } from "electron";
import path from "node:path";
import fs from "node:fs";
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

const currentFile = __filename;
const currentDir = __dirname;

const DEV_SERVER_URL = process.env.DESKTOP_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;
let currentWorkspacePath: string | null = null;
let pendingAuthUrl: string | null = null;

type AutoUpdater = (typeof import("electron-updater"))["autoUpdater"];

let autoUpdaterRef: AutoUpdater | null = null;
let autoUpdaterUnavailable = false;

type UpdateStatus = {
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

let updateStatus: UpdateStatus = { state: "idle" };

async function getAutoUpdater(): Promise<AutoUpdater | null> {
  if (autoUpdaterRef) return autoUpdaterRef;
  if (autoUpdaterUnavailable) return null;
  try {
    const mod = await import("electron-updater");
    autoUpdaterRef = mod.autoUpdater;
    return autoUpdaterRef;
  } catch (error) {
    autoUpdaterUnavailable = true;
    console.warn("[auto-update] electron-updater is unavailable:", error);
    return null;
  }
}

function resolveIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.png");
  }
  return path.join(currentDir, "..", "build", "icon.png");
}

function resolveIcnsPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.icns");
  }
  return path.join(currentDir, "..", "build", "icon.icns");
}

function loadAppIcon() {
  const candidates = [resolveIcnsPath(), resolveIconPath()];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) {
      return image;
    }
  }
  return undefined;
}

function formatReleaseNotes(releaseNotes: unknown): string | undefined {
  if (!releaseNotes) return undefined;
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((note) => {
        if (typeof note === "string") return note;
        if (note && typeof note === "object") {
          const version = (note as { version?: string }).version;
          const text = (note as { note?: string }).note;
          if (version || text) {
            return `${version ? `Version ${version}` : ""}${version && text ? "\n" : ""}${text ?? ""}`.trim();
          }
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  if (typeof releaseNotes === "string") return releaseNotes;
  return undefined;
}

function dispatchAuthUrl(url: string) {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send("auth:deepLink", url);
  } else {
    pendingAuthUrl = url;
  }
}

function dispatchUpdateStatus(status: UpdateStatus) {
  updateStatus = status;
  if (mainWindow?.webContents) {
    mainWindow.webContents.send("updates:status", status);
  }
}

function createWindow() {
  const appIcon = loadAppIcon();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#09090b",
    titleBarStyle: "hiddenInset",
    icon: appIcon,
    webPreferences: {
      preload: path.join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(currentDir, "..", "dist", "index.html");
    mainWindow.loadFile(indexPath);
  }

  if (pendingAuthUrl) {
    const url = pendingAuthUrl;
    pendingAuthUrl = null;
    mainWindow.webContents.once("did-finish-load", () => {
      dispatchAuthUrl(url);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function setupAutoUpdates() {
  if (!app.isPackaged) {
    dispatchUpdateStatus({
      state: "disabled",
      message: "Updates are available in packaged builds."
    });
    return;
  }

  const updater = await getAutoUpdater();
  if (!updater) {
    dispatchUpdateStatus({
      state: "disabled",
      message: "electron-updater not installed."
    });
    return;
  }

  updater.autoDownload = true;

  updater.on("checking-for-update", () => {
    dispatchUpdateStatus({ state: "checking" });
  });

  updater.on("update-available", (info) => {
    dispatchUpdateStatus({
      state: "available",
      version: info?.version,
      message: "Update available. Downloading...",
      releaseNotes: formatReleaseNotes(info?.releaseNotes)
    });
  });

  updater.on("update-not-available", () => {
    dispatchUpdateStatus({ state: "not-available", message: "You are up to date." });
  });

  updater.on("download-progress", (progress) => {
    dispatchUpdateStatus({
      state: "downloading",
      progress: progress.percent,
      message: "Downloading update...",
      releaseNotes: updateStatus.releaseNotes
    });
  });

  updater.on("error", (error) => {
    console.error("[auto-update] Error:", error);
    dispatchUpdateStatus({
      state: "error",
      error: error?.message || String(error),
      message: "Update failed."
    });
  });

  updater.on("update-downloaded", (info) => {
    dispatchUpdateStatus({
      state: "downloaded",
      version: info?.version,
      message: "Update ready to install.",
      releaseNotes: formatReleaseNotes(info?.releaseNotes) ?? updateStatus.releaseNotes
    });
    const result = dialog.showMessageBoxSync({
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update ready",
      message: "A new version is ready to install."
    });

    if (result === 0) {
      updater.quitAndInstall();
    }
  });

  updater.checkForUpdates().catch((error) => {
    console.error("[auto-update] Failed to check for updates:", error);
  });
}

app.on("ready", () => {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("numezis-code", process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient("numezis-code");
  }
  if (process.platform === "darwin") {
    const dockIcon = loadAppIcon();
    if (dockIcon) {
      app.dock.setIcon(dockIcon);
    }
  }
  createWindow();
  void setupAutoUpdates();
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

app.on("open-url", (event, url) => {
  event.preventDefault();
  dispatchAuthUrl(url);
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

ipcMain.handle("app:getVersion", () => app.getVersion());

ipcMain.handle("app:getUpdateStatus", () => updateStatus);

ipcMain.handle("app:checkForUpdates", async () => {
  if (!app.isPackaged) {
    dispatchUpdateStatus({
      state: "disabled",
      message: "Updates are available in packaged builds."
    });
    return updateStatus;
  }
  dispatchUpdateStatus({ state: "checking" });
  try {
    const updater = await getAutoUpdater();
    if (!updater) {
      dispatchUpdateStatus({
        state: "disabled",
        message: "electron-updater not installed."
      });
      return updateStatus;
    }
    await updater.checkForUpdates();
  } catch (error) {
    dispatchUpdateStatus({
      state: "error",
      error: error instanceof Error ? error.message : String(error),
      message: "Update failed."
    });
  }
  return updateStatus;
});

ipcMain.handle("app:restartToUpdate", async () => {
  if (!app.isPackaged) return false;
  const updater = await getAutoUpdater();
  if (!updater) return false;
  updater.quitAndInstall();
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
