// src/config.ts
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";
import { getDatabase } from "./lib/db";


dotenv.config();

// -------------------------------------------------------------------
// 1️⃣ Schema – shape of persisted config
// -------------------------------------------------------------------
const ConfigSchema = z.object({
  workingFolder: z.string().min(1, "Working folder path cannot be empty"),
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
// 5️⃣ Load configuration (NO FALLBACKS - explicit config only)
// -------------------------------------------------------------------
export async function loadConfig(): Promise<Config> {
  const db = await getDatabase();
  const collection = db.collection<WorkspaceConfigDoc>(COLLECTION_NAME);
  const persisted = await collection.findOne({});

  if (!persisted?.workingFolder || persisted.workingFolder.trim() === "") {
    throw new ConfigNotSetError(
      "Working folder not configured. Please set it in Configuration > Workspace Settings."
    );
  }

  const result = ConfigSchema.safeParse(persisted);
  if (!result.success) {
    throw new ConfigNotSetError(`Invalid configuration: ${result.error.message}`);
  }

  // Runtime validation – check directory exists (no git requirement)
  const dir = path.resolve(result.data.workingFolder);
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
    const configDir = path.resolve(process.cwd(), "config");
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

    // Update workingFolder and write back
    existingConfig.workingFolder = newConfig.workingFolder;
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

export async function getConfig(): Promise<Config> {
  // Always load from disk to ensure we pick up changes immediately 
  cachedConfig = await loadConfig();
  return cachedConfig;
}

export async function refreshConfig(): Promise<Config> {
  cachedConfig = await loadConfig();
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

// Default provider
const VALID_PROVIDERS = ["azure", "openai", "claude", "gemini", "lmstudio", "ollama"];
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
  graphRecursionLimit,
  mongo: {
    uri: process.env.MONGODB_URI,
    user: process.env.MONGODB_USER,
    pass: process.env.MONGODB_PASS,
  },
};
