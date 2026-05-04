// src/config.ts
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import { getDatabase } from "./lib/db";

// Use __filename and __dirname equivalents in ESM, or fallback to standard in CJS.
// We are in TS transpiled to commonjs / esm, so we'll use a robust approach
export function getProjectRoot(): string {
  // Walk up from this file's directory until we find package.json containing "kletron"
  // This file is in packages/server/src/config.ts or packages/server/dist/config.js
  let currentDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, "package.json"))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(currentDir, "package.json"), "utf-8"));
        if (pkg.name === "kletron" || pkg.workspaces) {
          return currentDir;
        }
      } catch {
        // ignore
      }
    }
    currentDir = path.dirname(currentDir);
  }
  return process.cwd(); // Final fallback
}


dotenv.config();

// -------------------------------------------------------------------
// 1️⃣ Schema – shape of persisted config
// -------------------------------------------------------------------

/** Per-tool approval override: always_approve | always_require | default */
const ToolOverrideSchema = z.enum(["always_approve", "always_require", "default"]).default("default");
export type ToolOverride = z.infer<typeof ToolOverrideSchema>;

const ToolApprovalConfigSchema = z.object({
  /** Sources for which readonly tools are auto-approved (comma-separated or array) */
  autoApproveReadonlySources: z.array(z.string()).default(["agent", "automation"]),
  /** Tools that should never be auto-approved, regardless of class */
  neverAutoApproveTools: z.array(z.string()).default([]),
  /** Whether safe bash commands (ls, cat, grep, etc.) are auto-approved */
  autoApproveSafeBash: z.boolean().default(true),
  /** Per-tool overrides: { "execute_bash": "always_approve" | "always_require" | "default" } */
  toolOverrides: z.record(z.string(), ToolOverrideSchema).default({}),
});
export type ToolApprovalConfig = z.infer<typeof ToolApprovalConfigSchema>;

const ConfigSchema = z.object({
  workingFolder: z.string().min(1, "Working folder path cannot be empty"),
  toolApproval: ToolApprovalConfigSchema.optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

// -------------------------------------------------------------------
// 2️⃣ MongoDB collection
// -------------------------------------------------------------------
const COLLECTION_NAME = "workspace_configs";

type WorkspaceConfigDoc = Config & {
  _id?: unknown;
  updatedAt?: Date;
  createdAt?: Date;
};

// -------------------------------------------------------------------
// 3️⃣ Custom error for missing configuration
// -------------------------------------------------------------------
export class ConfigNotSetError extends Error {
  constructor(message: string = "Working folder not configured") {
    super(message);
    this.name = "ConfigNotSetError";
  }
}

// -------------------------------------------------------------------
// 4️⃣ Check if config exists (for UI feedback)
// -------------------------------------------------------------------
export function isConfigured(): boolean {
  return Boolean(cachedConfig?.workingFolder);
}

// -------------------------------------------------------------------
// 5️⃣ Load configuration (DB primary, config.json fallback)
// -------------------------------------------------------------------
export async function loadConfig(): Promise<Config> {
  let persisted: WorkspaceConfigDoc | null = null;
  let dbError: unknown = null;
  try {
    const db = await getDatabase();
    const collection = db.collection<WorkspaceConfigDoc>(COLLECTION_NAME);
    persisted = await collection.findOne({});
  } catch (error) {
    dbError = error;
    console.warn("[Config] Failed to load config from MongoDB. Falling back to config.json.", error);
  }

  if (!persisted?.workingFolder || persisted.workingFolder.trim() === "") {
    // Fallback to config/config.json (kept in sync by workspace service).
    // IMPORTANT: we only trust the explicit `workingFolder` field here.
    // `workspaceRoots` is treated purely as an allowlist for MCP and MUST
    // NOT be used to infer the active workspace, otherwise the first entry
    // can silently point the system at the wrong repository.
    try {
      const configDir = path.resolve(getProjectRoot(), "config");
      const configJsonPath = path.join(configDir, "config.json");
      if (fs.existsSync(configJsonPath)) {
        const raw = fs.readFileSync(configJsonPath, "utf-8");
        const data = JSON.parse(raw) as { workingFolder?: string };
        const fromFile = data.workingFolder?.trim() ?? "";
        if (fromFile) {
          const normalized = path.isAbsolute(fromFile) ? path.normalize(fromFile) : path.resolve(getProjectRoot(), fromFile);
          if (fs.existsSync(normalized) && fs.statSync(normalized).isDirectory()) {
            return { workingFolder: normalized };
          }
        }
      }
    } catch {
      // ignore fallback errors
    }
    if (dbError) {
      const message =
        dbError instanceof Error
          ? dbError.message
          : "Unknown database error";
      throw new Error(
        `Failed to load config from MongoDB and no config.json fallback was found. Underlying error: ${message}`
      );
    }
    throw new ConfigNotSetError(
      "Working folder not configured. Please set it in Configuration > Workspace Settings."
    );
  }

  const result = ConfigSchema.safeParse(persisted);
  if (!result.success) {
    throw new ConfigNotSetError(`Invalid configuration: ${result.error.message}`);
  }

  // Runtime validation – check directory exists (no git requirement)
  const dirPath = result.data.workingFolder.trim();
  const dir = path.isAbsolute(dirPath) ? path.normalize(dirPath) : path.resolve(getProjectRoot(), dirPath);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new ConfigNotSetError(
      `Configured path does not exist or is not a directory: ${dir}`
    );
  }

  return { workingFolder: dir };
}

// -------------------------------------------------------------------
// 6️⃣ Save configuration (persist to MongoDB + sync to config.json for MCP server)
// -------------------------------------------------------------------
export async function saveConfig(newConfig: Config): Promise<void> {
  const result = ConfigSchema.safeParse(newConfig);
  if (!result.success) {
    throw new Error(`Invalid config payload: ${result.error.message}`);
  }

  // 1. Save to MongoDB (primary source)
  const db = await getDatabase();
  const collection = db.collection<WorkspaceConfigDoc>(COLLECTION_NAME);
  await collection.updateOne(
    {},
    {
      $set: { workingFolder: newConfig.workingFolder, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  // 2. Sync to config/config.json for MCP server compatibility
  // The MCP server reads from this file for git operations
  try {
    const configDir = path.resolve(getProjectRoot(), "config");
    const configJsonPath = path.join(configDir, "config.json");

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Read existing config.json or create new one
    let existingConfig: Record<string, unknown> = {};
    if (fs.existsSync(configJsonPath)) {
      try {
        existingConfig = JSON.parse(fs.readFileSync(configJsonPath, "utf-8"));
      } catch {
        // If file is corrupted, start fresh
      }
    }

    // Update workingFolder and keep workspaceRoots in sync for MCP allowlists
    existingConfig.workingFolder = newConfig.workingFolder;
    const existingRoots = Array.isArray(existingConfig.workspaceRoots) ? existingConfig.workspaceRoots : [];
    const rootSet = new Set<string>(existingRoots);
    rootSet.add(newConfig.workingFolder);
    existingConfig.workspaceRoots = Array.from(rootSet);
    fs.writeFileSync(configJsonPath, JSON.stringify(existingConfig, null, 2), "utf-8");
    console.log(`[Config] Synced workingFolder to ${configJsonPath}`);
  } catch (e) {
    console.error("[Config] Failed to sync config.json:", e);
    // Non-fatal: MongoDB is the primary source
  }
}

// -------------------------------------------------------------------
// 7️⃣ Cached getter for convenience
// -------------------------------------------------------------------
let cachedConfig: Config | null = null;

/** Wire persisted toolApproval config into the policy module. */
function syncToolApprovalToPolicy(cfg: Config): void {
  if (cfg.toolApproval) {
    try {
      const { setToolApprovalConfigOverride } = require("./services/toolApprovalPolicy");
      setToolApprovalConfigOverride(cfg.toolApproval);
    } catch {
      // Policy module not available (e.g., in isolated scripts)
    }
  }
}

export async function getConfig(): Promise<Config> {
  // Always load from disk to ensure we pick up changes immediately 
  cachedConfig = await loadConfig();
  syncToolApprovalToPolicy(cachedConfig);
  return cachedConfig;
}

export async function refreshConfig(): Promise<Config> {
  cachedConfig = await loadConfig();
  syncToolApprovalToPolicy(cachedConfig);
  return cachedConfig;
}

// -------------------------------------------------------------------
// 8️⃣ Safe getter that returns null instead of throwing
// -------------------------------------------------------------------
export async function getConfigSafe(): Promise<Config | null> {
  try {
    return await getConfig();
  } catch (e) {
    if (e instanceof ConfigNotSetError) {
      return null;
    }
    throw e;
  }
}

// 9️⃣ Export other existing config values (preserve original API)
// -------------------------------------------------------------------

// Azure OpenAI
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
const azureModel = process.env.AZURE_OPENAI_MODEL ?? "gpt-4o";
const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview";

// OpenAI (direct)
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o";
const openaiOrganization = process.env.OPENAI_ORGANIZATION;

// Claude (Anthropic)
const claudeApiKey = process.env.ANTHROPIC_API_KEY;
const claudeModel = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

// Google Gemini
const geminiApiKey = process.env.GOOGLE_API_KEY;
const geminiModel = process.env.GOOGLE_MODEL ?? "gemini-2.5-flash";

// LM Studio
const lmstudioBaseUrl = process.env.LMSTUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1";
const lmstudioApiKey = process.env.LMSTUDIO_API_KEY;
const lmstudioModel = process.env.LMSTUDIO_MODEL ?? "";

// Ollama
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.2";

// vLLM
const vllmBaseUrl = process.env.VLLM_BASE_URL ?? "http://127.0.0.1:8001";
const vllmApiKey = process.env.VLLM_API_KEY;
const vllmModel = process.env.VLLM_MODEL ?? "";

// Default provider
const VALID_PROVIDERS = ["azure", "openai", "claude", "gemini", "lmstudio", "ollama", "vllm"];
const defaultProviderRaw = process.env.LLM_DEFAULT_PROVIDER;
const isDefaultProviderValid = VALID_PROVIDERS.includes(defaultProviderRaw ?? "");
const defaultProvider =
  (isDefaultProviderValid ? defaultProviderRaw : undefined) ??
  (azureEndpoint && azureApiKey && azureDeployment ? "azure" :
    openaiApiKey ? "openai" :
      claudeApiKey ? "claude" :
        geminiApiKey ? "gemini" : "lmstudio");

const parsedGraphRecursionLimit = Number.parseInt(
  process.env.GRAPH_RECURSION_LIMIT ?? "",
  10
);
const graphRecursionLimit =
  Number.isFinite(parsedGraphRecursionLimit) && parsedGraphRecursionLimit > 0
    ? parsedGraphRecursionLimit
    : 50;

if (!azureEndpoint && !openaiApiKey && !claudeApiKey && !geminiApiKey) {
  console.warn(
    "⚠️  No LLM API keys configured. Set one of: AZURE_OPENAI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY"
  );
}

export const config = {
  // workingFolder is now obtained via getConfig() lazily
  get workingFolder() {
    // Synchronous getter – assumes config has been loaded earlier
    if (!cachedConfig) {
      throw new ConfigNotSetError("Config not loaded yet – call getConfig() first.");
    }
    return cachedConfig.workingFolder;
  },
  // Legacy alias for mcpDefaultDir
  get mcpDefaultDir() {
    return this.workingFolder;
  },
  // Legacy alias for repoRoot
  get repoRoot() {
    return this.workingFolder;
  },
  defaultProvider,
  azure: {
    endpoint: azureEndpoint,
    apiKey: azureApiKey,
    deployment: azureDeployment,
    model: azureModel,
    apiVersion: azureApiVersion,
    embeddingDeployment: process.env.AZURE_EMBEDDING_DEPLOYMENT ?? "text-embedding-ada-002",
    embeddingModel: process.env.AZURE_EMBEDDING_MODEL ?? "text-embedding-ada-002",
  },
  openai: {
    apiKey: openaiApiKey,
    model: openaiModel,
    organization: openaiOrganization,
  },
  claude: {
    apiKey: claudeApiKey,
    model: claudeModel,
  },
  gemini: {
    apiKey: geminiApiKey,
    model: geminiModel,
  },
  lmstudio: {
    baseUrl: lmstudioBaseUrl,
    apiKey: lmstudioApiKey,
    model: lmstudioModel,
  },
  ollama: {
    baseUrl: ollamaBaseUrl,
    model: ollamaModel,
  },
  vllm: {
    baseUrl: vllmBaseUrl,
    apiKey: vllmApiKey,
    model: vllmModel,
  },
  graphRecursionLimit,
  mongo: {
    uri: process.env.MONGODB_URI,
    user: process.env.MONGODB_USER,
    pass: process.env.MONGODB_PASS,
  },
};

// -------------------------------------------------------------------
// 🔐 Tool Approval Config — persisted subset for tool approval settings
// -------------------------------------------------------------------

/** Default tool approval config (used when no config is persisted yet) */
const DEFAULT_TOOL_APPROVAL: ToolApprovalConfig = {
  autoApproveReadonlySources: ["agent", "automation"],
  neverAutoApproveTools: [],
  autoApproveSafeBash: true,
  toolOverrides: {},
};

/**
 * Resolves tool approval config with priority:
 * 1. Persisted config (MongoDB workspace_configs → toolApproval)
 * 2. Environment variables (legacy fallback)
 * 3. Defaults
 */
export function getToolApprovalConfig(): ToolApprovalConfig {
  // If persisted config has toolApproval, use it
  if (cachedConfig?.toolApproval) {
    return cachedConfig.toolApproval;
  }

  // Fallback: env vars (backwards compatibility)
  const envSources = process.env.AUTO_APPROVE_READONLY_SOURCES;
  const envNever = process.env.NEVER_AUTO_APPROVE_TOOLS;
  const envSafeBash = process.env.AUTO_APPROVE_SAFE_BASH;

  return {
    autoApproveReadonlySources: envSources
      ? envSources.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : DEFAULT_TOOL_APPROVAL.autoApproveReadonlySources,
    neverAutoApproveTools: envNever
      ? envNever.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : DEFAULT_TOOL_APPROVAL.neverAutoApproveTools,
    autoApproveSafeBash: envSafeBash !== undefined
      ? envSafeBash.trim().toLowerCase() === "true"
      : DEFAULT_TOOL_APPROVAL.autoApproveSafeBash,
    toolOverrides: DEFAULT_TOOL_APPROVAL.toolOverrides,
  };
}

/**
 * Persist updated tool approval config to MongoDB.
 */
export async function saveToolApprovalConfig(updates: Partial<ToolApprovalConfig>): Promise<ToolApprovalConfig> {
  const current = getToolApprovalConfig();
  const merged: ToolApprovalConfig = {
    ...current,
    ...updates,
    toolOverrides: { ...current.toolOverrides, ...(updates.toolOverrides ?? {}) },
  };

  const db = await getDatabase();
  const collection = db.collection<WorkspaceConfigDoc>(COLLECTION_NAME);
  await collection.updateOne(
    {},
    {
      $set: { toolApproval: merged, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  // Refresh cached config
  if (cachedConfig) {
    cachedConfig = { ...cachedConfig, toolApproval: merged };
  }

  console.log(`[Config] Tool approval config saved:`, JSON.stringify(merged));
  return merged;
}
