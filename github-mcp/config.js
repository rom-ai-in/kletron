import path from "path";

// ⚙️ Configuration du Serveur MCP

const configuredDir =
  process.env.GITHUB_MCP_DEFAULT_DIR ||
  process.env.MCP_DEFAULT_DIR ||
  "/Users/romainmagnin/Desktop";

const fetchAllowlistRaw =
  process.env.GITHUB_MCP_FETCH_ALLOWLIST || process.env.MCP_FETCH_ALLOWLIST || "";

const fetchAllowlist = fetchAllowlistRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  // 📂 Dossier par défaut analysé si aucun chemin n'est précisé.
  defaultDir: configuredDir ? path.resolve(configuredDir) : undefined,

  // 🌐 Allowlist de domaines autorisés pour fetch_url (ex: "docs.github.com,raw.githubusercontent.com,*.npmjs.com").
  fetchAllowlist,

  // 📦 Limite de taille de réponse (bytes) pour fetch_url.
  fetchMaxBytes: Number(process.env.MCP_FETCH_MAX_BYTES || process.env.GITHUB_MCP_FETCH_MAX_BYTES || 1_000_000),
};
