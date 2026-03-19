import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ⚙️ Configuration du Serveur MCP
// Reads from config/config.json (same as UI) instead of environment variables

// Get the config directory path (relative to project root)
const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "../..");
const configFilePath = path.join(projectRoot, "config", "config.json");

/**
 * Read workingFolder from config/config.json
 * This is the same config file used by the frontend UI at /config/
 */
function getWorkingFolderFromConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      const raw = fs.readFileSync(configFilePath, "utf-8");
      const data = JSON.parse(raw);
      if (data.workingFolder && data.workingFolder.trim()) {
        const folder = data.workingFolder.trim();
        return path.isAbsolute(folder) ? path.normalize(folder) : path.resolve(projectRoot, folder);
      }
    }
  } catch (e) {
    console.warn(`[MCP Config] Failed to read ${configFilePath}:`, e.message);
  }
  return null;
}

function getWorkspaceRootsFromConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      const raw = fs.readFileSync(configFilePath, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data.workspaceRoots) && data.workspaceRoots.length > 0) {
        return data.workspaceRoots.map((root) => {
            const trimmed = root.trim();
            return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(projectRoot, trimmed);
        });
      }
      if (data.workingFolder && data.workingFolder.trim()) {
        const folder = data.workingFolder.trim();
        return [path.isAbsolute(folder) ? path.normalize(folder) : path.resolve(projectRoot, folder)];
      }
    }
  } catch (e) {
    console.warn(`[MCP Config] Failed to read workspace roots:`, e.message);
  }
  const fallback = getWorkingFolderFromConfig();
  return fallback ? [path.isAbsolute(fallback) ? path.normalize(fallback) : path.resolve(projectRoot, fallback)] : [];
}

// Read fetch allowlist from both config.json and env vars
function getFetchAllowlist() {
  // First try config.json
  try {
    if (fs.existsSync(configFilePath)) {
      const raw = fs.readFileSync(configFilePath, "utf-8");
      const data = JSON.parse(raw);
      if (data.fetchAllowlist && Array.isArray(data.fetchAllowlist)) {
        return data.fetchAllowlist;
      }
    }
  } catch (e) {
    // Fall through to env vars
  }
  // Fallback to env var
  const fetchAllowlistRaw = process.env.MCP_FETCH_ALLOWLIST || "";
  return fetchAllowlistRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const configuredDir = getWorkingFolderFromConfig();
const workspaceRoots = getWorkspaceRootsFromConfig();

export const config = {
  // 📂 Dossier par défaut analysé si aucun chemin n'est précisé.
  // Will be null if not configured, requiring explicit path in tool calls
  defaultDir: configuredDir,
  workspaceRoots,

  // Helper to check if configured
  get isConfigured() {
    return this.defaultDir !== null;
  },

  // 🌐 Allowlist de domaines autorisés pour fetch_url
  fetchAllowlist: getFetchAllowlist(),

  // 📦 Limite de taille de réponse (bytes) pour fetch_url.
  fetchMaxBytes: Number(process.env.MCP_FETCH_MAX_BYTES || 1_000_000),

  // 🔄 Method to reload config from file (for dynamic updates)
  reload() {
    this.defaultDir = getWorkingFolderFromConfig();
    this.fetchAllowlist = getFetchAllowlist();
    this.workspaceRoots = getWorkspaceRootsFromConfig();
    console.log(`[MCP Config] Reloaded: defaultDir=${this.defaultDir}`);
  }
};

// Log current config on load
console.log(`[MCP Config] Loaded from ${configFilePath}`);
console.log(`[MCP Config] defaultDir: ${config.defaultDir}`);
console.log(`[MCP Config] fetchAllowlist: ${config.fetchAllowlist.length} domains`);
console.log(`[MCP Config] workspaceRoots: ${config.workspaceRoots?.length ?? 0}`);
