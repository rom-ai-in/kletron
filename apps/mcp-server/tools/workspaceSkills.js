// Workspace skills/connectors gating for the bundled MCP server.
//
// Strategy:
//   1. Resolve the active workspace's "capabilities" (enabled tools, skills,
//      integrations, external MCP servers) by calling the web API with the
//      MCP_INTERNAL_TOKEN. The web API is the source of truth (Mongo).
//   2. If the web API is unreachable (offline desktop, ci, etc.), fall back
//      to .kletron/skills.json + .kletron/connectors.json on the workspace
//      root. This keeps the MCP server usable in dev without web running.
//   3. Filter the bundled tool set down to the enabled tool names.
//
// `getActiveToolsForWorkspace(workspaceRoot, categoryId)` returns
// `{ [toolName]: toolImpl }`. `getCapabilities(workspaceRoot)` returns the
// raw resolved capability shape so other code (e.g. external MCP proxy) can
// consume it.

import path from "path";
import fs from "fs";
import {
    fetchCapabilities,
    readLocalCapabilities,
    resolveWorkspaceIdFromRoot,
} from "./capabilityClient.js";

const CACHE_TTL_MS = 30_000;

class WorkspaceCapabilityCache {
    constructor() {
        this.cache = new Map();
    }
    get(key) {
        const hit = this.cache.get(key);
        if (!hit) return null;
        if (Date.now() - hit.t > CACHE_TTL_MS) {
            this.cache.delete(key);
            return null;
        }
        return hit.value;
    }
    set(key, value) {
        this.cache.set(key, { t: Date.now(), value });
    }
    invalidate(key) {
        if (key) this.cache.delete(key);
        else this.cache.clear();
    }
}

class WorkspaceSkillsManager {
    constructor() {
        this.cache = new WorkspaceCapabilityCache();
    }

    cacheKey(workspaceRoot) {
        return path.normalize(workspaceRoot || "default");
    }

    /**
     * Resolve capabilities for a workspace. Uses Mongo via the web API when
     * available; falls back to local .kletron files otherwise.
     */
    async getCapabilities(workspaceRoot, ownerId) {
        const key = this.cacheKey(workspaceRoot);
        const cached = this.cache.get(key);
        if (cached) return cached;

        let capabilities = null;
        try {
            const workspaceId = await resolveWorkspaceIdFromRoot(workspaceRoot);
            if (workspaceId) {
                capabilities = await fetchCapabilities(workspaceId, ownerId);
            }
        } catch (error) {
            console.warn(
                "[workspaceSkills] capability fetch failed, falling back to local files:",
                error.message
            );
        }
        if (!capabilities) {
            capabilities = readLocalCapabilities(workspaceRoot);
        }
        this.cache.set(key, capabilities);
        return capabilities;
    }

    invalidateCache(workspaceRoot) {
        this.cache.invalidate(workspaceRoot ? this.cacheKey(workspaceRoot) : undefined);
    }

    async getAvailableSkills(workspaceRoot) {
        const capabilities = await this.getCapabilities(workspaceRoot);
        return capabilities.enabledSkills?.map((s) => s.slug ?? s) ?? [];
    }

    async getWorkspaceConnectors(workspaceRoot) {
        const capabilities = await this.getCapabilities(workspaceRoot);
        return [
            ...capabilities.enabledIntegrationProviderIds.map((providerId) => ({
                providerId,
                kind: "integration",
            })),
            ...capabilities.externalMcpServers.map((s) => ({
                ...s,
                kind: "mcp_server",
            })),
        ];
    }

    async getAllAvailableSkills() {
        // The library is exposed by the web API; the MCP server itself
        // shouldn't be the source of truth for catalog browsing.
        const baseUrl = (process.env.KLETRON_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
        const internalToken = process.env.MCP_INTERNAL_TOKEN || process.env.KLETRON_INTERNAL_TOKEN;
        if (!internalToken) return [];
        try {
            const res = await fetch(`${baseUrl}/api/skills`, {
                headers: { "x-mcp-internal-token": internalToken },
            });
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json?.skills) ? json.skills : [];
        } catch {
            return [];
        }
    }

    async getActiveToolsForWorkspace(workspaceRoot, categoryId) {
        const capabilities = await this.getCapabilities(workspaceRoot);
        const enabledNames = new Set(capabilities.enabledTools ?? []);

        const { buildAllTools } = await import("../server.js");
        let allTools;
        try {
            allTools = buildAllTools();
        } catch (error) {
            console.warn("[workspaceSkills] Could not load full tool set:", error.message);
            return {};
        }

        // If the resolver provided enabled tools, trust that list. Otherwise
        // fall back to a permissive baseline so the agent isn't paralyzed
        // when no Mongo / no .kletron files are present.
        if (enabledNames.size === 0) {
            return this.fallbackBaseline(allTools, categoryId);
        }

        const result = {};
        for (const name of enabledNames) {
            if (allTools[name]) result[name] = allTools[name];
        }
        return result;
    }

    fallbackBaseline(allTools, categoryId) {
        const baseTools = [
            "list_files",
            "read_file",
            "read_file_range",
            "search_code",
            "describe_structure",
            "symbols_list",
            "find_symbol",
            "go_to_definition",
            "references",
            "todo_search",
            "repo_metrics",
        ];
        if (categoryId === "drafting") {
            baseTools.push("write_file", "fetch_url", "web_search");
        } else {
            baseTools.push("execute_bash", "git_log", "git_diff", "git_grep", "git_blame");
        }
        const out = {};
        for (const name of baseTools) {
            if (allTools[name]) out[name] = allTools[name];
        }
        return out;
    }

    // ─── Local persistence helpers (offline mode) ────────────────────────

    async _ensureKletronDir(workspaceRoot) {
        if (!workspaceRoot) return;
        const kletronDir = path.join(workspaceRoot, ".kletron");
        if (!fs.existsSync(kletronDir)) {
            fs.mkdirSync(kletronDir, { recursive: true });
        }
    }

    async _readLocalSkills(workspaceRoot) {
        if (!workspaceRoot) return { skills: [] };
        const p = path.join(workspaceRoot, ".kletron", "skills.json");
        try {
            if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
        } catch (err) {
            console.warn("[workspaceSkills] readLocalSkills:", err.message);
        }
        return { skills: [] };
    }

    async _writeLocalSkills(workspaceRoot, config) {
        await this._ensureKletronDir(workspaceRoot);
        const p = path.join(workspaceRoot, ".kletron", "skills.json");
        fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf-8");
        this.invalidateCache(workspaceRoot);
    }

    async enableSkill(workspaceRoot, skillId) {
        const cfg = await this._readLocalSkills(workspaceRoot);
        cfg.skills = Array.isArray(cfg.skills) ? cfg.skills : [];
        if (!cfg.skills.includes(skillId)) {
            cfg.skills.push(skillId);
            await this._writeLocalSkills(workspaceRoot, cfg);
        }
    }

    async disableSkill(workspaceRoot, skillId) {
        const cfg = await this._readLocalSkills(workspaceRoot);
        if (Array.isArray(cfg.skills) && cfg.skills.includes(skillId)) {
            cfg.skills = cfg.skills.filter((id) => id !== skillId);
            await this._writeLocalSkills(workspaceRoot, cfg);
        }
    }

    async addConnector(workspaceRoot, connectorConfig) {
        await this._ensureKletronDir(workspaceRoot);
        const p = path.join(workspaceRoot, ".kletron", "connectors.json");
        let arr = [];
        try {
            if (fs.existsSync(p)) arr = JSON.parse(fs.readFileSync(p, "utf-8"));
        } catch {
            arr = [];
        }
        if (!Array.isArray(arr)) arr = [];
        arr.push(connectorConfig);
        fs.writeFileSync(p, JSON.stringify(arr, null, 2), "utf-8");
        this.invalidateCache(workspaceRoot);
    }

    async removeConnector(workspaceRoot, connectorId) {
        const p = path.join(workspaceRoot, ".kletron", "connectors.json");
        if (!fs.existsSync(p)) return;
        let arr = [];
        try {
            arr = JSON.parse(fs.readFileSync(p, "utf-8"));
        } catch {
            arr = [];
        }
        if (!Array.isArray(arr)) return;
        const next = arr.filter((c) => c?.id !== connectorId);
        fs.writeFileSync(p, JSON.stringify(next, null, 2), "utf-8");
        this.invalidateCache(workspaceRoot);
    }
}

export const workspaceSkillsManager = new WorkspaceSkillsManager();
