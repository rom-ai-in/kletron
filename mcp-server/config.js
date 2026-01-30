import path from "path";
import fs from "fs";

// ⚙️ Configuration du Serveur MCP
// Reads from config/config.json (same as UI) instead of environment variables

// Get the config directory path (relative to project root)
const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
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
        return path.resolve(data.workingFolder);
      }
    }
  } catch (e) {
    console.warn(`[MCP Config] Failed to read ${configFilePath}:`, e.message);
  }
  // Fallback to env vars if config.json not found (backward compatibility)
  return process.env.GITHUB_MCP_DEFAULT_DIR || process.env.MCP_DEFAULT_DIR || null;
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
  // Fallback to env vars
  const fetchAllowlistRaw =
    process.env.GITHUB_MCP_FETCH_ALLOWLIST || process.env.MCP_FETCH_ALLOWLIST || "";
  return fetchAllowlistRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const configuredDir = getWorkingFolderFromConfig();

export const config = {
  // 📂 Dossier par défaut analysé si aucun chemin n'est précisé.
  // Will be null if not configured, requiring explicit path in tool calls
  defaultDir: configuredDir,

  // Helper to check if configured
  get isConfigured() {
    return this.defaultDir !== null;
  },

  // 🌐 Allowlist de domaines autorisés pour fetch_url
  fetchAllowlist: getFetchAllowlist(),

  // 📦 Limite de taille de réponse (bytes) pour fetch_url.
  fetchMaxBytes: Number(process.env.MCP_FETCH_MAX_BYTES || process.env.GITHUB_MCP_FETCH_MAX_BYTES || 1_000_000),

  // 🔄 Method to reload config from file (for dynamic updates)
  reload() {
    this.defaultDir = getWorkingFolderFromConfig();
    this.fetchAllowlist = getFetchAllowlist();
    console.log(`[MCP Config] Reloaded: defaultDir=${this.defaultDir}`);
  }
};

// Log current config on load
console.log(`[MCP Config] Loaded from ${configFilePath}`);
console.log(`[MCP Config] defaultDir: ${config.defaultDir}`);
console.log(`[MCP Config] fetchAllowlist: ${config.fetchAllowlist.length} domains`);

