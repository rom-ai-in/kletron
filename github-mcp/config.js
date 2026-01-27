import path from "path";

// ⚙️ Configuration du Serveur MCP

// Get configured directory from environment - NO FALLBACK TO process.cwd()
const configuredDir =
  process.env.GITHUB_MCP_DEFAULT_DIR ||
  process.env.MCP_DEFAULT_DIR ||
  null; // Explicit null when not configured

const fetchAllowlistRaw =
  process.env.GITHUB_MCP_FETCH_ALLOWLIST || process.env.MCP_FETCH_ALLOWLIST || "";

const fetchAllowlist = fetchAllowlistRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  // 📂 Dossier par défaut analysé si aucun chemin n'est précisé.
  // Will be null if not configured, requiring explicit path in tool calls
  defaultDir: configuredDir ? path.resolve(configuredDir) : null,

  // Helper to check if configured
  get isConfigured() {
    return this.defaultDir !== null;
  },

  // 🌐 Allowlist de domaines autorisés pour fetch_url (ex: "docs.github.com,raw.githubusercontent.com,*.npmjs.com").
  fetchAllowlist,

  // 📦 Limite de taille de réponse (bytes) pour fetch_url.
  fetchMaxBytes: Number(process.env.MCP_FETCH_MAX_BYTES || process.env.GITHUB_MCP_FETCH_MAX_BYTES || 1_000_000),
};
