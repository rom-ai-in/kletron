import path from "node:path";
import fs from "node:fs";
import { ObjectId } from "mongodb";
import { getDatabase } from "../lib/db";
import { getConfigSafe } from "../config";

export type WorkspaceStatus = "active" | "archived";

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

export async function listWorkspaces(ownerId: string): Promise<Workspace[]> {
  try {
    await claimLegacyWorkspaces(ownerId);
    const collection = await getWorkspaceCollection();
    return collection
      .find({ status: { $ne: "archived" }, ownerId })
      .sort({ updatedAt: -1 })
      .toArray();
  } catch (error) {
    console.warn("[Workspace] listWorkspaces fallback:", (error as Error)?.message ?? error);
    const fallback = await getFallbackWorkspace(ownerId);
    return fallback ? [fallback] : [];
  }
}

export async function listAllWorkspaces(): Promise<Workspace[]> {
  try {
    const collection = await getWorkspaceCollection();
    return collection.find({ status: { $ne: "archived" } }).sort({ updatedAt: -1 }).toArray();
  } catch (error) {
    console.warn("[Workspace] listAllWorkspaces fallback:", (error as Error)?.message ?? error);
    const fallback = await getFallbackWorkspace();
    return fallback ? [fallback] : [];
  }
}

export async function getWorkspaceById(id: string, ownerId: string): Promise<Workspace | null> {
  try {
    await claimLegacyWorkspaces(ownerId);
    if (!ObjectId.isValid(id)) return null;
    const collection = await getWorkspaceCollection();
    return collection.findOne({ _id: new ObjectId(id), ownerId });
  } catch (error) {
    console.warn("[Workspace] getWorkspaceById fallback:", (error as Error)?.message ?? error);
    if (id !== FALLBACK_WORKSPACE_ID) return null;
    return await getFallbackWorkspace(ownerId);
  }
}

export async function getWorkspaceByIdUnsafe(id: string): Promise<Workspace | null> {
  try {
    if (!ObjectId.isValid(id)) return null;
    const collection = await getWorkspaceCollection();
    return collection.findOne({ _id: new ObjectId(id) });
  } catch (error) {
    console.warn("[Workspace] getWorkspaceByIdUnsafe fallback:", (error as Error)?.message ?? error);
    if (id !== FALLBACK_WORKSPACE_ID) return null;
    return await getFallbackWorkspace();
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
  await syncConfigJson();
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
  await syncConfigJson();
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
  await syncConfigJson();
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
  const activeWorkspaceId = id ? new ObjectId(id) : undefined;
  await state.updateOne(
    { _id: ownerId },
    { $set: { activeWorkspaceId, updatedAt: new Date() } },
    { upsert: true }
  );

  if (id) {
    const collection = await getWorkspaceCollection();
    await collection.updateOne(
      { _id: new ObjectId(id), ownerId },
      { $set: { lastUsed: new Date(), updatedAt: new Date() } }
    );
  }

  await syncConfigJson();
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
    console.warn("[Workspace] getActiveWorkspaceId fallback:", (error as Error)?.message ?? error);
    const fallback = await getFallbackWorkspace(ownerId);
    return fallback ? FALLBACK_WORKSPACE_ID : null;
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
    console.warn("[Workspace] getActiveWorkspace fallback:", (error as Error)?.message ?? error);
    return await getFallbackWorkspace(ownerId);
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

export async function syncConfigJson() {
  try {
    const workspaceList = await listAllWorkspaces();
    const activeId = workspaceList[0]?._id?.toString() ?? null;
    const active = activeId ? await getWorkspaceByIdUnsafe(activeId) : null;
    const configDir = path.resolve(process.cwd(), "config");
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

    const activeRoot =
      active?.rootPath ??
      (typeof existingConfig.workingFolder === "string" ? existingConfig.workingFolder : undefined);
    const workspaceRoots = workspaceList.map((ws) => ws.rootPath);
    const rootSet = new Set<string>(workspaceRoots);
    if (activeRoot) {
      rootSet.add(activeRoot);
    }

    existingConfig.workingFolder = activeRoot ?? existingConfig.workingFolder;
    existingConfig.workspaceRoots = Array.from(rootSet);

    fs.writeFileSync(configJsonPath, JSON.stringify(existingConfig, null, 2), "utf-8");
  } catch (error) {
    console.error("[Workspace] Failed to sync config.json:", error);
  }
}

export async function resolveWorkspaceFromRequest(
  request: Request,
  ownerId: string,
  body?: Record<string, unknown> | null
): Promise<Workspace | null> {
  const url = new URL(request.url);
  const headerId = request.headers.get("x-workspace-id");
  const queryId = url.searchParams.get("workspaceId");
  const bodyId =
    typeof body?.workspaceId === "string" ? body.workspaceId : undefined;

  const id = bodyId || headerId || queryId;
  try {
    if (id) {
      const workspace = await getWorkspaceById(id, ownerId);
      return workspace;
    }

    return await getActiveWorkspace(ownerId);
  } catch (error) {
    console.warn("[Workspace] Falling back to config.json workspace:", (error as Error)?.message ?? error);
    const config = await getConfigSafe();
    if (!config?.workingFolder) {
      return null;
    }
    const now = new Date();
    return {
      _id: new ObjectId("000000000000000000000001"),
      ownerId,
      name: path.basename(config.workingFolder),
      rootPath: path.resolve(config.workingFolder),
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastUsed: now,
    };
  }
}

export function toWorkspaceSummary(workspace: Workspace) {
  return toSummary(workspace);
}
