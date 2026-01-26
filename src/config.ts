// src/config.ts
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
// import simpleGit from "simple-git"; // Removed due to missing package
import { z } from "zod";


dotenv.config();

// -------------------------------------------------------------------
// 1️⃣ Schema – shape of persisted config
// -------------------------------------------------------------------
const ConfigSchema = z.object({
  mcpDefaultDir: z.string().min(1, "Path cannot be empty"),
});
export type Config = z.infer<typeof ConfigSchema>;

// -------------------------------------------------------------------
// 2️⃣ Paths for persisted JSON
// -------------------------------------------------------------------
const CONFIG_DIR = path.resolve(process.cwd(), "config");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// -------------------------------------------------------------------
// 3️⃣ Helper – verify directory is a Git repo (GitHub‑enabled)
// -------------------------------------------------------------------
async function isGitRepo(dir: string): Promise<boolean> {
  try {
    // const git = simpleGit(dir);
    // return await git.checkIsRepo();
    // Simplified check:
    return fs.existsSync(path.join(dir, ".git"));
  } catch {
    return false;
  }
}


// -------------------------------------------------------------------
// 4️⃣ Load configuration (persisted JSON → env fallback → validation)
// -------------------------------------------------------------------
export async function loadConfig(): Promise<Config> {
  // 4a) Load persisted JSON if present
  let persisted: Partial<Config> = {};
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    persisted = JSON.parse(raw);
  }

  // 4b) Fallback to environment variables
  const envFallback: Partial<Config> = {
    mcpDefaultDir:
      process.env.GITHUB_MCP_DEFAULT_DIR ||
      process.env.MCP_DEFAULT_DIR ||
      "",
  };

  // 4c) Merge (persisted overrides env)
  const merged = { ...envFallback, ...persisted };

  // 4d) Validate schema
  const result = ConfigSchema.safeParse(merged);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }

  // 4e) Runtime validation – existence & Git repo
  const dir = path.resolve(result.data.mcpDefaultDir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Configured path does not exist or is not a directory: ${dir}`);
  }
  if (!(await isGitRepo(dir))) {
    throw new Error(`Configured path is not a Git repository: ${dir}`);
  }

  return { mcpDefaultDir: dir };
}

// -------------------------------------------------------------------
// 5️⃣ Save configuration (persist to JSON)
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
// 6️⃣ Cached getter for convenience (used by existing imports)
// -------------------------------------------------------------------
let cachedConfig: Config | null = null;
export async function getConfig(): Promise<Config> {
  // Always load from disk to ensure we pick up changes immediately 
  // without complex cache invalidation across API route instances.
  cachedConfig = await loadConfig();
  return cachedConfig;
}

export async function refreshConfig(): Promise<Config> {
  cachedConfig = await loadConfig();
  return cachedConfig;
}

// -------------------------------------------------------------------
// 7️⃣ Export other existing config values (preserve original API)
// -------------------------------------------------------------------
// NOTE: The rest of the original config file (Azure, LMStudio, etc.)
// remains unchanged – we only replace the repo‑root handling.

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
  // repoRoot is now obtained via getConfig() lazily
  get repoRoot() {
    // Synchronous getter – assumes config has been loaded earlier
    if (!cachedConfig) {
      throw new Error("Config not loaded yet – call getConfig() first.");
    }
    return cachedConfig.mcpDefaultDir;
  },
  defaultProvider,
  azure: {
    endpoint: azureEndpoint,
    apiKey: azureApiKey,
    deployment: azureDeployment,
    model: azureModel,
    apiVersion: azureApiVersion,
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
