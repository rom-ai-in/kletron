import { app, BrowserWindow, dialog, ipcMain, shell, nativeImage, Menu, powerSaveBlocker } from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import {
  applyFileChange,
  getGitStatus,
  getWorkspaceInfo,
  gitCheckout,
  gitCloneRepo,
  gitCommitAll,
  gitCommitStaged,
  gitCreateBranch,
  gitListBranches,
  gitDiff,
  gitDiffStaged,
  gitDiffNumstat,
  gitStageFile,
  gitStageAll,
  gitUnstageFile,
  gitUnstageAll,
  gitRevertFile,
  gitRevertAll,
  gitPush,
  gitCreatePR,
  listFiles,
  readFile,
  writeFile
} from "@kletron/bridge";

const currentDir = __dirname;

const DEV_SERVER_URL = process.env.DESKTOP_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;
let currentWorkspacePath: string | null = null;
let pendingAuthUrl: string | null = null;
/**
 * Renderer-reported session state (`app:setSignedIn`). Drives the app menu: signed out,
 * the navigation items are greyed out to match the in-app gate instead of pointing at
 * views the renderer will refuse to show.
 */
let signedIn = false;

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

/** Renderer asks to block system sleep while agent work is active (see Settings → General). */
let preventSleepBlockerId: number | null = null;

function resolveCodexBinaryCandidate(): string {
  const envPath = process.env.KLETRON_CODEX_BINARY?.trim();
  if (envPath) {
    const resolved = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
    if (fs.existsSync(resolved)) return resolved;
  }

  const binNames = process.platform === "win32" ? ["codex.cmd", "codex.ps1", "codex"] : ["codex"];
  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 14; i++) {
    for (const name of binNames) {
      const candidate = path.join(dir, "node_modules", ".bin", name);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  try {
    const tool = process.platform === "win32" ? "where" : "which";
    const stdout = execFileSync(tool, ["codex"], { encoding: "utf8", windowsHide: true });
    const first = stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (first && fs.existsSync(first)) return first;
  } catch {
    // ignore
  }

  return "codex";
}

async function readCodexVersion(binaryPath: string): Promise<{ ok: boolean; version?: string; error?: string }> {
  return await new Promise((resolve) => {
    const child = spawn(binaryPath, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      resolve({ ok: false, error: error.message });
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ ok: true, version: stdout.trim() || stderr.trim() || "unknown" });
        return;
      }
      resolve({ ok: false, error: stderr.trim() || stdout.trim() || `exit code ${code}` });
    });
  });
}

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

function installAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Account…",
                enabled: signedIn,
                click: () => mainWindow?.webContents.send("app:openSettings", "account"),
              },
              signedIn
                ? {
                    label: "Sign Out",
                    click: () => mainWindow?.webContents.send("app:auth", "sign-out"),
                  }
                : {
                    label: "Sign In…",
                    click: () => mainWindow?.webContents.send("app:auth", "sign-in"),
                  },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          } as Electron.MenuItemConstructorOptions,
        ]
      : []),
    ...(process.platform === "darwin"
      ? [
          {
            label: "File",
            submenu: [
              {
                label: "Add workspace…",
                accelerator: "CommandOrControl+O",
                enabled: signedIn,
                click: () => mainWindow?.webContents.send("app:addWorkspace"),
              },
              {
                label: "Configuration…",
                accelerator: "CommandOrControl+,",
                enabled: signedIn,
                click: () => mainWindow?.webContents.send("app:openSettings"),
              },
              { type: "separator" },
              { role: "close" },
            ],
          } as Electron.MenuItemConstructorOptions,
        ]
      : [
          {
            label: "File",
            submenu: [
              {
                label: "Add workspace…",
                accelerator: "CommandOrControl+O",
                enabled: signedIn,
                click: () => mainWindow?.webContents.send("app:addWorkspace"),
              },
              {
                label: "Configuration…",
                accelerator: "CommandOrControl+,",
                enabled: signedIn,
                click: () => mainWindow?.webContents.send("app:openSettings"),
              },
              { type: "separator" },
              { role: "quit" },
            ],
          } as Electron.MenuItemConstructorOptions,
        ]),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Code / Work mode",
          accelerator: "CommandOrControl+Shift+M",
          enabled: signedIn,
          click: () => mainWindow?.webContents.send("app:toggleWorkMode"),
        },
        { type: "separator" },
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Navigate",
      submenu: [
        {
          label: "Agent",
          enabled: signedIn,
          click: () => {
            mainWindow?.webContents.send("app:navigate", "app");
          },
        },
        {
          label: "History",
          enabled: signedIn,
          click: () => {
            mainWindow?.webContents.send("app:navigate", "history");
          },
        },
        {
          label: "Automations",
          enabled: signedIn,
          click: () => {
            mainWindow?.webContents.send("app:navigate", "automations");
          },
        },
        {
          label: "Agent Graphs",
          enabled: signedIn,
          click: () => {
            mainWindow?.webContents.send("app:navigate", "agent-graphs");
          },
        },
        {
          label: "Configuration",
          enabled: signedIn,
          click: () => {
            mainWindow?.webContents.send("app:navigate", "settings");
          },
        },
        {
          label: "Account",
          enabled: signedIn,
          click: () => {
            mainWindow?.webContents.send("app:openSettings", "account");
          },
        },
        {
          label: "Messenger channels",
          enabled: signedIn,
          click: () => {
            mainWindow?.webContents.send("app:openSettings", "channels");
          },
        },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const appIcon = loadAppIcon();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    // Opaque window: transparent + vibrancy causes broken compositing on some macOS/Electron
    // builds (blank or clipped UI while CSS backdrops still “work”). Glass look stays in CSS.
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
    void mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(currentDir, "..", "dist", "index.html");
    void mainWindow.loadFile(indexPath);
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

function findKletronProtocolUrl(argv: string[]): string | undefined {
  return argv.find((arg) => typeof arg === "string" && arg.startsWith("kletron://"));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", (_event, commandLine) => {
  const url = findKletronProtocolUrl(commandLine);
  if (url) dispatchAuthUrl(url);
});

app.on("ready", () => {
  const coldStartAuthUrl = findKletronProtocolUrl(process.argv);
  if (coldStartAuthUrl) {
    pendingAuthUrl = coldStartAuthUrl;
  }
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("kletron", process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient("kletron");
  }
  if (process.platform === "darwin") {
    const dockIcon = loadAppIcon();
    if (dockIcon) {
      app.dock?.setIcon(dockIcon);
    }
  }
  createWindow();
  installAppMenu();
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

app.on("before-quit", () => {
  if (preventSleepBlockerId !== null) {
    powerSaveBlocker.stop(preventSleepBlockerId);
    preventSleepBlockerId = null;
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
  if (!workspacePath?.trim()) {
    currentWorkspacePath = null;
    return null;
  }
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

ipcMain.handle("codex:openAuthUrl", async (_event, url: string) => {
  if (!url) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("codex:health", async () => {
  const binaryPath = resolveCodexBinaryCandidate();
  const version = await readCodexVersion(binaryPath);
  return {
    enabled: true,
    available: version.ok,
    binaryPath,
    version: version.version ?? null,
    error: version.error ?? null,
  };
});

ipcMain.handle("codex:diagnostics", async () => {
  const binaryPath = resolveCodexBinaryCandidate();
  const version = await readCodexVersion(binaryPath);
  return {
    binaryPath,
    ...version,
  };
});

ipcMain.handle("app:setPreventSleep", async (_event, enabled: boolean) => {
  if (enabled) {
    if (preventSleepBlockerId === null) {
      preventSleepBlockerId = powerSaveBlocker.start("prevent-app-suspension");
    }
  } else if (preventSleepBlockerId !== null) {
    powerSaveBlocker.stop(preventSleepBlockerId);
    preventSleepBlockerId = null;
  }
  return true;
});

/** Renderer mirrors its session state here so the app menu matches the in-app gate. */
ipcMain.handle("app:setSignedIn", (_event, value: boolean) => {
  const next = !!value;
  if (next === signedIn) return signedIn;
  signedIn = next;
  installAppMenu();
  return signedIn;
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

/** Open a folder in the OS file manager (Finder / Explorer / …). */
ipcMain.handle("app:openWorkspaceInSystemFileManager", async (_event, targetPath?: string) => {
  const resolved = targetPath || currentWorkspacePath;
  if (!resolved) return false;
  const normalized = path.normalize(resolved);
  const err = await shell.openPath(normalized);
  return err === "";
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

// Helper: resolve the workspace path from an explicit cwd or the global fallback.
function resolveWorkspace(cwd?: string): string {
  const resolved = cwd || currentWorkspacePath;
  if (!resolved) throw new Error("Workspace not set");
  return resolved;
}

ipcMain.handle("git:status", async (_event, cwd?: string) => {
  try {
    return await getGitStatus(resolveWorkspace(cwd));
  } catch (error) {
    // Non-git directories: return null silently instead of spamming the console
    const msg = (error as Error)?.message ?? "";
    if (msg.includes("not a git repository")) {
      return null;
    }
    throw error;
  }
});

ipcMain.handle("git:commit", async (_event, message: string, cwd?: string) => {
  return gitCommitAll(resolveWorkspace(cwd), message);
});

ipcMain.handle("git:createBranch", async (_event, branch: string, cwd?: string) => {
  return gitCreateBranch(resolveWorkspace(cwd), branch);
});

ipcMain.handle("git:checkout", async (_event, branch: string, cwd?: string) => {
  return gitCheckout(resolveWorkspace(cwd), branch);
});

ipcMain.handle("git:clone", async (_event, repoUrl: string, branch?: string) => {
  const result = await gitCloneRepo(repoUrl, undefined, branch);
  currentWorkspacePath = result.repoPath;
  return result.workspace;
});

ipcMain.handle("git:listBranches", async (_event, cwd?: string) => {
  return gitListBranches(resolveWorkspace(cwd));
});

ipcMain.handle("git:diff", async (_event, filePath?: string, cwd?: string) => {
  return gitDiff(resolveWorkspace(cwd), filePath);
});

ipcMain.handle("git:diffStaged", async (_event, filePath?: string, cwd?: string) => {
  return gitDiffStaged(resolveWorkspace(cwd), filePath);
});

ipcMain.handle("git:stageFile", async (_event, filePath: string, cwd?: string) => {
  return gitStageFile(resolveWorkspace(cwd), filePath);
});

ipcMain.handle("git:stageAll", async (_event, cwd?: string) => {
  return gitStageAll(resolveWorkspace(cwd));
});

ipcMain.handle("git:unstageFile", async (_event, filePath: string, cwd?: string) => {
  return gitUnstageFile(resolveWorkspace(cwd), filePath);
});

ipcMain.handle("git:unstageAll", async (_event, cwd?: string) => {
  return gitUnstageAll(resolveWorkspace(cwd));
});

ipcMain.handle("git:revertFile", async (_event, filePath: string, cwd?: string) => {
  return gitRevertFile(resolveWorkspace(cwd), filePath);
});

ipcMain.handle("git:revertAll", async (_event, cwd?: string) => {
  return gitRevertAll(resolveWorkspace(cwd));
});

ipcMain.handle("git:commitStaged", async (_event, message: string, cwd?: string) => {
  return gitCommitStaged(resolveWorkspace(cwd), message);
});

ipcMain.handle("git:push", async (_event, remote?: string, branch?: string, cwd?: string) => {
  return gitPush(resolveWorkspace(cwd), remote, branch);
});

ipcMain.handle("git:createPR", async (_event, title: string, body?: string, base?: string, cwd?: string) => {
  return gitCreatePR(resolveWorkspace(cwd), title, body, base);
});

ipcMain.handle("git:diffNumstat", async (_event, cwd?: string) => {
  return gitDiffNumstat(resolveWorkspace(cwd));
});

// ── Command Center IPC ──────────────────────────────────────────────────────

ipcMain.handle("app:pickFile", async () => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "All Files", extensions: ["*"] },
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] },
    ],
  });
  return result.filePaths;
});

ipcMain.handle("app:captureScreenshot", async () => {
  const { desktopCapturer, screen } = require("electron");
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: screen.getPrimaryDisplay().workAreaSize,
    });
    if (sources.length > 0) {
      const screenshot = sources[0].thumbnail.toDataURL();
      return screenshot;
    }
    return null;
  } catch {
    return null;
  }
});

ipcMain.handle("app:popOutThread", async (_event: any, { threadId, title }: { threadId: string; title: string }) => {
  const { BrowserWindow } = require("electron");
  const popout = new BrowserWindow({
    width: 520,
    height: 720,
    title: title || "Thread",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the same URL but with a hash for pop-out routing
  const mainUrl = mainWindow?.webContents.getURL() || "";
  const baseUrl = mainUrl.split("#")[0];
  popout.loadURL(`${baseUrl}#/popout/${threadId}`);

  return popout.id;
});
