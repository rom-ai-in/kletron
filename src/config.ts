// src/config.ts
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";


dotenv.config();

// -------------------------------------------------------------------
// 1️⃣ Schema – shape of persisted config
// -------------------------------------------------------------------
const ConfigSchema = z.object({
  workingFolder: z.string().min(1, "Working folder path cannot be empty"),
});
export type Config = z.infer<typeof ConfigSchema>;

// -------------------------------------------------------------------
// 2️⃣ Paths for persisted JSON
// -------------------------------------------------------------------
const CONFIG_DIR = path.resolve(process.cwd(), "config");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

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
  if (!fs.existsSync(CONFIG_FILE)) {
    return false;
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const data = JSON.parse(raw);
    return !!(data.workingFolder && data.workingFolder.trim().length > 0);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------
// 5️⃣ Load configuration (NO FALLBACKS - explicit config only)
// -------------------------------------------------------------------
export async function loadConfig(): Promise<Config> {
  // Only load from persisted JSON - no environment variable fallback
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new ConfigNotSetError(
      "Working folder not configured. Please configure it in Configuration > Workspace Settings."
    );
  }

  let persisted: Partial<Config>;
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    persisted = JSON.parse(raw);
  } catch (e) {
    throw new ConfigNotSetError(
      "Failed to read configuration file. Please re-configure in Configuration > Workspace Settings."
    );
  }

  // Validate that workingFolder is explicitly set
  if (!persisted.workingFolder || persisted.workingFolder.trim() === "") {
    throw new ConfigNotSetError(
      "Working folder not configured. Please set it in Configuration > Workspace Settings."
    );
  }

  // Validate schema
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
// 6️⃣ Save configuration (persist to JSON)
// -------------------------------------------------------------------
export async function saveConfig(newConfig: Config): Promise<void> {
  const result = ConfigSchema.safeParse(newConfig);
  if (!result.success) {
    throw new Error(`Invalid config payload: ${result.error.message}`);
  }

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), "utf-8");
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

// -------------------------------------------------------------------
// 9️⃣ Export other existing config values (preserve original API)
// -------------------------------------------------------------------
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
const azureModel = process.env.AZURE_OPENAI_MODEL ?? "gpt-5-mini";
const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview";
const lmstudioBaseUrl = process.env.LMSTUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1";
const lmstudioApiKey = process.env.LMSTUDIO_API_KEY;
const lmstudioModel = process.env.LMSTUDIO_MODEL ?? "";
const defaultProviderRaw = process.env.LLM_DEFAULT_PROVIDER;
const isDefaultProviderValid =
  defaultProviderRaw === "azure" || defaultProviderRaw === "lmstudio";
const defaultProvider =
  (isDefaultProviderValid ? defaultProviderRaw : undefined) ??
  (azureEndpoint && azureApiKey && azureDeployment ? "azure" : "lmstudio");

const parsedGraphRecursionLimit = Number.parseInt(
  process.env.GRAPH_RECURSION_LIMIT ?? "",
  10
);
const graphRecursionLimit =
  Number.isFinite(parsedGraphRecursionLimit) && parsedGraphRecursionLimit > 0
    ? parsedGraphRecursionLimit
    : 50;

if (!azureEndpoint || !azureApiKey || !azureDeployment) {
  console.warn(
    "⚠️  Azure OpenAI variables (AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY/AZURE_OPENAI_DEPLOYMENT) are not set."
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
  lmstudio: {
    baseUrl: lmstudioBaseUrl,
    apiKey: lmstudioApiKey,
    model: lmstudioModel,
  },
  graphRecursionLimit,
  mongo: {
    uri: process.env.MONGODB_URI,
    user: process.env.MONGODB_USER,
    pass: process.env.MONGODB_PASS,
  },
};
