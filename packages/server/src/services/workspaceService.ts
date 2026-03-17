import path from "node:path";
import fs from "node:fs";
import { ObjectId } from "mongodb";
import { getDatabase } from "../lib/db";
import { getConfigSafe, saveConfig, getProjectRoot } from "../config";

export type WorkspaceStatus = "active" | "archived";
export type WorkspaceHealthStatus = "healthy" | "missing" | "inaccessible";
export type WorkspaceErrorCode =
  | "WORKSPACE_NOT_CONFIGURED"
  | "WORKSPACE_PATH_MISSING"
  | "WORKSPACE_PATH_INACCESSIBLE";

export interface Workspace {
  _id?: ObjectId;
  ownerId?: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  provider?: string;
  defaultBranch?: string;
  status?: WorkspaceStatus;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
}

export type WorkspaceHealth = {
  status: WorkspaceHealthStatus;
  rootPath: string;
  message?: string;
};

export type WorkspaceResolutionErrorPayload = {
  code: WorkspaceErrorCode;
  message: string;
  workspaceId?: string | null;
  rootPath?: string | null;
  action: "select_or_fix_workspace";
};

const WORKSPACE_COLLECTION = "workspaces";
const STATE_COLLECTION = "workspace_state";
const FALLBACK_WORKSPACE_ID = "000000000000000000000001";
const FALLBACK_WORKSPACE_OBJECT_ID = new ObjectId(FALLBACK_WORKSPACE_ID);

type WorkspaceStateDoc = {
  _id: string;
  activeWorkspaceId?: ObjectId;
  updatedAt?: Date;
};

const normalizeRootPath = (rootPath: string) => path.resolve(rootPath.trim());

function ensureDirectory(rootPath: string) {
  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
    throw new Error(`Workspace path does not exist or is not a directory: ${rootPath}`);
  }
}

export class WorkspaceResolutionError extends Error {
  code: WorkspaceErrorCode;
  status: number;
  payload: WorkspaceResolutionErrorPayload;

  constructor(
    code: WorkspaceErrorCode,
    status: number,
    message: string,
    details?: { workspaceId?: string | null; rootPath?: string | null }
  ) {
    super(message);
    this.name = "WorkspaceResolutionError";
    this.code = code;
    this.status = status;
    this.payload = {
      code,
      message,
      workspaceId: details?.workspaceId ?? null,
      rootPath: details?.rootPath ?? null,
      action: "select_or_fix_workspace",
    };
  }
}

async function getWorkspaceCollection() {
  const db = await getDatabase();
  return db.collection<Workspace>(WORKSPACE_COLLECTION);
}

async function getStateCollection() {
  const db = await getDatabase();
  return db.collection<WorkspaceStateDoc>(STATE_COLLECTION);
}

function toSummary(workspace: Workspace) {
  return {
    id: workspace._id?.toString() ?? "",
    name: workspace.name,
    rootPath: workspace.rootPath,
    repoUrl: workspace.repoUrl,
    provider: workspace.provider,
    defaultBranch: workspace.defaultBranch,
    status: workspace.status,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    lastUsed: workspace.lastUsed,
  };
}

export function validateWorkspaceRoot(workspace: Workspace): WorkspaceHealth {
  const rootPath = path.resolve(workspace.rootPath || "");
  if (!rootPath) {
    return { status: "missing", rootPath, message: "Workspace path is empty" };
  }
  try {
    if (!fs.existsSync(rootPath)) {
      return {
        status: "missing",
        rootPath,
        message: `Workspace path does not exist: ${rootPath}`,
      };
    }
    const stat = fs.statSync(rootPath);
    if (!stat.isDirectory()) {
      return {
        status: "missing",
        rootPath,
        message: `Workspace path is not a directory: ${rootPath}`,
      };
    }
    fs.accessSync(rootPath, fs.constants.R_OK);
    return { status: "healthy", rootPath };
  } catch (error) {
    return {
      status: "inaccessible",
      rootPath,
      message: (error as Error)?.message ?? "Workspace path is not accessible",
    };
  }
}

export function assertWorkspaceHealthy(workspace: Workspace): Workspace {
  const health = validateWorkspaceRoot(workspace);
  if (health.status === "healthy") return workspace;
  const workspaceId = workspace._id?.toString() ?? null;
  if (health.status === "missing") {
    throw new WorkspaceResolutionError(
      "WORKSPACE_PATH_MISSING",
      422,
      health.message ?? "Workspace path is missing",
      { workspaceId, rootPath: health.rootPath }
    );
  }
  throw new WorkspaceResolutionError(
    "WORKSPACE_PATH_INACCESSIBLE",
    422,
    health.message ?? "Workspace path is inaccessible",
    { workspaceId, rootPath: health.rootPath }
  );
}

export function asWorkspaceResolutionError(error: unknown): WorkspaceResolutionError | null {
  if (error instanceof WorkspaceResolutionError) return error;
  return null;
}

export function workspaceErrorToHttp(
  error: unknown
): { status: number; body: WorkspaceResolutionErrorPayload } | null {
  const resolved = asWorkspaceResolutionError(error);
  if (!resolved) return null;
  return { status: resolved.status, body: resolved.payload };
}

async function getFallbackWorkspace(ownerId?: string): Promise<Workspace | null> {
  const config = await getConfigSafe();
  if (!config?.workingFolder) return null;
  const now = new Date();
  return {
    _id: FALLBACK_WORKSPACE_OBJECT_ID,
    ownerId,
    name: path.basename(config.workingFolder),
    rootPath: path.resolve(config.workingFolder),
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastUsed: now,
  };
}

export function formatWorkspaceResponse(workspace: Workspace | null) {
  return workspace ? toSummary(workspace) : null;
}

async function claimLegacyWorkspaces(ownerId: string) {
  const collection = await getWorkspaceCollection();
  const hasOwner = await collection.findOne({ ownerId: { $exists: true } });
  if (hasOwner) return;
  await collection.updateMany(
    { ownerId: { $exists: false } },
    { $set: { ownerId } }
  );
}

// Guard to avoid re-running seed logic on every listWorkspaces call
const _seededOwners = new Set<string>();

export async function listWorkspaces(ownerId: string): Promise<Workspace[]> {
  try {
    await claimLegacyWorkspaces(ownerId);
    const collection = await getWorkspaceCollection();
    // Return all non-archived workspaces for the owner
    let workspaces = await collection.find({ status: { $ne: "archived" }, ownerId }).sort({ updatedAt: -1 }).toArray();

    // Auto-seed: ensure config.workingFolder is always persisted in the DB.
    // This runs once per process per ownerId to avoid repeated checks.
    if (!_seededOwners.has(ownerId)) {
      _seededOwners.add(ownerId);

      if (workspaces.length === 0) {
        // No workspaces at all — bootstrap from legacy config
        const bootstrapped = await bootstrapFromLegacyConfig(ownerId);
        if (bootstrapped) {
          workspaces = await collection.find({ status: { $ne: "archived" }, ownerId }).sort({ updatedAt: -1 }).toArray();
        }
      } else {
        // Has workspaces — but check if config.workingFolder is missing
        const config = await getConfigSafe();
        if (config?.workingFolder) {
          const normalizedConfigPath = path.resolve(config.workingFolder);
          const alreadyExists = workspaces.some(
            (ws) => path.resolve(ws.rootPath) === normalizedConfigPath
          );
          if (!alreadyExists && fs.existsSync(normalizedConfigPath)) {
            try {
              await createWorkspace({
                ownerId,
                rootPath: normalizedConfigPath,
                name: path.basename(normalizedConfigPath),
              });
              workspaces = await collection.find({ status: { $ne: "archived" }, ownerId }).sort({ updatedAt: -1 }).toArray();
            } catch (seedErr) {
              console.warn("[Workspace] Failed to seed config.workingFolder:", (seedErr as Error)?.message);
            }
          }
        }
      }
    }

    return workspaces;
  } catch (error) {
    console.error("[Workspace] listWorkspaces error:", (error as Error)?.message ?? error);
    return [];
  }
}

export async function listAllWorkspaces(): Promise<Workspace[]> {
  try {
    const collection = await getWorkspaceCollection();
    return collection.find({ status: { $ne: "archived" } }).sort({ updatedAt: -1 }).toArray();
  } catch (error) {
    console.error("[Workspace] listAllWorkspaces error:", (error as Error)?.message ?? error);
    return [];
  }
}

export async function getWorkspaceById(id: string, ownerId: string): Promise<Workspace | null> {
  try {
    await claimLegacyWorkspaces(ownerId);
    if (!ObjectId.isValid(id)) return null;
    const collection = await getWorkspaceCollection();
    return collection.findOne({ _id: new ObjectId(id), ownerId });
  } catch (error) {
    console.error("[Workspace] getWorkspaceById error:", (error as Error)?.message ?? error);
    return null;
  }
}

export async function getWorkspaceByIdUnsafe(id: string): Promise<Workspace | null> {
  try {
    if (!ObjectId.isValid(id)) return null;
    const collection = await getWorkspaceCollection();
    return collection.findOne({ _id: new ObjectId(id) });
  } catch (error) {
    console.error("[Workspace] getWorkspaceByIdUnsafe error:", (error as Error)?.message ?? error);
    return null;
  }
}

export async function getWorkspaceByRootPath(rootPath: string, ownerId: string): Promise<Workspace | null> {
  await claimLegacyWorkspaces(ownerId);
  const collection = await getWorkspaceCollection();
  const normalized = normalizeRootPath(rootPath);
  return collection.findOne({ rootPath: normalized, ownerId });
}

export async function createWorkspace(input: {
  ownerId: string;
  name?: string;
  rootPath: string;
  repoUrl?: string;
  provider?: string;
  defaultBranch?: string;
}): Promise<Workspace> {
  const normalized = normalizeRootPath(input.rootPath);
  ensureDirectory(normalized);

  const existing = await getWorkspaceByRootPath(normalized, input.ownerId);
  if (existing) {
    if (existing.status === "archived") {
      const collection = await getWorkspaceCollection();
      await collection.updateOne(
        { _id: existing._id },
        { $set: { status: "active", updatedAt: new Date(), ...(input.name && { name: input.name }) } }
      );
      existing.status = "active";
      if (input.name) existing.name = input.name;
    }
    return existing;
  }

  const now = new Date();
  const workspace: Workspace = {
    ownerId: input.ownerId,
    name: input.name?.trim() || path.basename(normalized),
    rootPath: normalized,
    repoUrl: input.repoUrl,
    provider: input.provider,
    defaultBranch: input.defaultBranch,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastUsed: now,
  };

  const collection = await getWorkspaceCollection();
  const result = await collection.insertOne(workspace as any);
  workspace._id = result.insertedId;
  await syncConfigJson(input.ownerId);
  return workspace;
}

export async function updateWorkspace(
  id: string,
  ownerId: string,
  updates: Partial<Workspace>
): Promise<Workspace | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getWorkspaceCollection();
  const updateDoc: Partial<Workspace> = {
    ...updates,
    ...(updates.rootPath ? { rootPath: normalizeRootPath(updates.rootPath) } : {}),
    updatedAt: new Date(),
  };
  await collection.updateOne({ _id: new ObjectId(id), ownerId }, { $set: updateDoc });
  await syncConfigJson(ownerId);
  return getWorkspaceById(id, ownerId);
}

export async function deleteWorkspace(id: string, ownerId: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const collection = await getWorkspaceCollection();
  await collection.updateOne(
    { _id: new ObjectId(id), ownerId },
    { $set: { status: "archived", updatedAt: new Date() } }
  );
  const activeId = await getActiveWorkspaceId(ownerId);
  if (activeId === id) {
    await setActiveWorkspaceId(ownerId, null);
  }
  await syncConfigJson(ownerId);
}

export async function setActiveWorkspaceId(ownerId: string, id: string | null): Promise<void> {
  const state = await getStateCollection();
  if (id && !ObjectId.isValid(id)) {
    throw new Error("Invalid workspace ID");
  }
  if (id) {
    const ownedWorkspace = await getWorkspaceById(id, ownerId);
    if (!ownedWorkspace) {
      throw new Error("Workspace not found");
    }
  }
  if (id) {
    const activeWorkspaceId = new ObjectId(id);
    await state.updateOne(
      { _id: ownerId },
      { $set: { activeWorkspaceId, updatedAt: new Date() } },
      { upsert: true }
    );
  } else {
    await state.updateOne(
      { _id: ownerId },
      { $unset: { activeWorkspaceId: "" }, $set: { updatedAt: new Date() } },
      { upsert: true }
    );
  }

  if (id) {
    const collection = await getWorkspaceCollection();
    await collection.updateOne(
      { _id: new ObjectId(id), ownerId },
      { $set: { lastUsed: new Date(), updatedAt: new Date() } }
    );
  }

  await syncConfigJson(ownerId);
}

export async function getActiveWorkspaceId(ownerId: string): Promise<string | null> {
  try {
    const state = await getStateCollection();
    const doc = await state.findOne({ _id: ownerId });
    if (doc?.activeWorkspaceId) return doc.activeWorkspaceId.toString();

    const legacy = await state.findOne({ _id: "active" as any });
    if (!legacy?.activeWorkspaceId) return null;

    const legacyId = legacy.activeWorkspaceId.toString();
    const owned = await getWorkspaceById(legacyId, ownerId);
    if (!owned) return null;

    await setActiveWorkspaceId(ownerId, legacyId);
    return legacyId;
  } catch (error) {
    console.error("[Workspace] getActiveWorkspaceId error:", (error as Error)?.message ?? error);
    return null;
  }
}

export async function getActiveWorkspace(ownerId: string): Promise<Workspace | null> {
  try {
    const activeId = await getActiveWorkspaceId(ownerId);
    if (activeId) {
      const workspace = await getWorkspaceById(activeId, ownerId);
      if (workspace) return workspace;
    }
    return bootstrapFromLegacyConfig(ownerId);
  } catch (error) {
    console.error("[Workspace] getActiveWorkspace error:", (error as Error)?.message ?? error);
    return null;
  }
}

export async function setActiveWorkspaceFromPath(ownerId: string, rootPath: string, name?: string) {
  const normalized = normalizeRootPath(rootPath);
  ensureDirectory(normalized);
  const existing = await getWorkspaceByRootPath(normalized, ownerId);
  const workspace = existing
    ? existing
    : await createWorkspace({ ownerId, rootPath: normalized, name });
  await setActiveWorkspaceId(ownerId, workspace._id?.toString() ?? null);
  return workspace;
}

export async function bootstrapFromLegacyConfig(ownerId: string): Promise<Workspace | null> {
  const existing = await listWorkspaces(ownerId);
  if (existing.length > 0) {
    const activeId = await getActiveWorkspaceId(ownerId);
    if (activeId) return getWorkspaceById(activeId, ownerId);
  }

  const legacy = await getConfigSafe();
  if (!legacy?.workingFolder) return null;

  try {
    const workspace = await setActiveWorkspaceFromPath(ownerId, legacy.workingFolder, "Imported Workspace");
    return workspace;
  } catch (error) {
    console.warn("[Workspace] Failed to bootstrap from legacy config:", error);
    return null;
  }
}

async function reloadMcpClientBestEffort() {
  try {
    const { McpClient } = await import("@kletron/mcp-client/client");
    await McpClient.reloadInstance();
  } catch (error) {
    // Non-fatal: config is already persisted, reload can fail in contexts
    // where MCP is not running/available.
    console.warn("[Workspace] MCP reload skipped:", (error as Error)?.message ?? error);
  }
}

export async function syncConfigJson(ownerId?: string) {
  try {
    const workspaceList = await listAllWorkspaces();
    const activeWorkspace =
      ownerId
        ? await getActiveWorkspace(ownerId)
        : (workspaceList.find((ws) => validateWorkspaceRoot(ws).status === "healthy") ?? workspaceList[0] ?? null);

    const activeRoot = activeWorkspace?.rootPath;

    // 1) Persist the active workspace root as the canonical workingFolder
    // in the workspace config collection and mirror it to config/config.json.
    if (activeRoot) {
      await saveConfig({ workingFolder: path.resolve(activeRoot) });
    }

    // 2) Ensure config/config.json.workspaceRoots is the union of all known
    // workspace root paths plus the active root.  This is used by the MCP
    // server purely as an allowlist / discovery set, NOT for selecting the
    // active workspace.
    const configDir = path.resolve(getProjectRoot(), "config");
    const configJsonPath = path.join(configDir, "config.json");

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let existingConfig: Record<string, unknown> = {};
    if (fs.existsSync(configJsonPath)) {
      try {
        existingConfig = JSON.parse(fs.readFileSync(configJsonPath, "utf-8"));
      } catch {
        existingConfig = {};
      }
    }

    const workspaceRoots = workspaceList.map((ws) => ws.rootPath);
    const rootSet = new Set<string>(
      Array.isArray((existingConfig as any).workspaceRoots)
        ? ((existingConfig as any).workspaceRoots as string[])
        : []
    );
    for (const root of workspaceRoots) {
      rootSet.add(path.resolve(root));
    }
    if (activeRoot) {
      rootSet.add(path.resolve(activeRoot));
    }

    existingConfig.workspaceRoots = Array.from(rootSet);

    fs.writeFileSync(configJsonPath, JSON.stringify(existingConfig, null, 2), "utf-8");
    await reloadMcpClientBestEffort();
  } catch (error) {
    console.error("[Workspace] Failed to sync config.json:", error);
  }
}

export async function resolveWorkspaceFromRequest(
  request: Request,
  ownerId: string,
  body?: Record<string, unknown> | null,
  options?: { requireExplicitWorkspace?: boolean }
): Promise<Workspace | null> {
  try {
    return await resolveWorkspaceFromRequestStrict(request, ownerId, body, options);
  } catch (error) {
    if (asWorkspaceResolutionError(error)) {
      return null;
    }
    throw error;
  }
}

export async function resolveWorkspaceFromRequestStrict(
  request: Request,
  ownerId: string,
  body?: Record<string, unknown> | null,
  options?: { requireExplicitWorkspace?: boolean }
): Promise<Workspace | null> {
  const url = new URL(request.url);
  const headerId = request.headers.get("x-workspace-id");
  const queryId = url.searchParams.get("workspaceId");
  const bodyId =
    typeof body?.workspaceId === "string" ? body.workspaceId : undefined;

  const id = bodyId || headerId || queryId;
  let workspace: Workspace | null = null;
  if (id) {
    workspace = await getWorkspaceById(id, ownerId);
  } else if (!options?.requireExplicitWorkspace) {
    const activeId = await getActiveWorkspaceId(ownerId);
    workspace = activeId ? await getWorkspaceById(activeId, ownerId) : null;
  } else {
    throw new Error("Explicit workspaceId is required in headers or query parameters for this operation to prevent cross-workspace data leakage.");
  }
  if (!workspace) return null;
  return assertWorkspaceHealthy(workspace);
}

export async function resolveWorkspaceFromRequestSafe(
  request: Request,
  ownerId: string,
  body?: Record<string, unknown> | null
): Promise<
  | { workspace: Workspace; error: null }
  | { workspace: null; error: WorkspaceResolutionError | null }
> {
  try {
    const workspace = await resolveWorkspaceFromRequestStrict(request, ownerId, body);
    return workspace ? { workspace, error: null } : { workspace: null, error: null };
  } catch (error) {
    return {
      workspace: null,
      error: asWorkspaceResolutionError(error),
    };
  }
}

export function toWorkspaceSummary(workspace: Workspace) {
  return toSummary(workspace);
}
