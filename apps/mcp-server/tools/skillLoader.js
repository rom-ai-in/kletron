// MCP tools that expose the skills library to the agent.
// `list_all_skills` returns the global HTTP catalog. Workspace-scoped listing
// is `list_available_skills` (registered from workspaceSkills.js). `load_skill`
// returns resolved skill content (frontmatter + body).

const DEFAULT_BASE_URL = process.env.KLETRON_WEB_BASE_URL || "http://127.0.0.1:3000";

function getBaseUrl() {
    return (process.env.KLETRON_WEB_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

async function fetchSkills() {
    const internalToken = process.env.MCP_INTERNAL_TOKEN || process.env.KLETRON_INTERNAL_TOKEN;
    if (!internalToken) return [];
    try {
        const res = await fetch(`${getBaseUrl()}/api/skills`, {
            headers: { "x-mcp-internal-token": internalToken },
        });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json?.skills) ? json.skills : [];
    } catch {
        return [];
    }
}

async function fetchSkill(slug) {
    const internalToken = process.env.MCP_INTERNAL_TOKEN || process.env.KLETRON_INTERNAL_TOKEN;
    if (!internalToken) return null;
    try {
        const res = await fetch(`${getBaseUrl()}/api/skills/${encodeURIComponent(slug)}`, {
            headers: { "x-mcp-internal-token": internalToken },
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.skill ?? null;
    } catch {
        return null;
    }
}

export async function listSkills() {
    const skills = await fetchSkills();
    return skills.map((s) => ({
        slug: s.slug,
        name: s.name,
        description: s.description,
        version: s.version,
        tags: s.tags,
        source: s.source,
    }));
}

export async function loadSkill(skillId) {
    if (!skillId) return null;
    return fetchSkill(skillId);
}

// MCP tool wrappers (used by server.js buildAllTools).
export const list_all_skills = {
    description:
        "List all skills in the Kletron library via HTTP (built-in + user). For skills enabled in this workspace only, call list_available_skills instead.",
    inputSchema: { type: "object", properties: {} },
    async run() {
        return listSkills();
    },
};

/** @deprecated Use list_all_skills; kept for older MCP clients. */
export const list_skills = list_all_skills;

export const load_skill = {
    description:
        "Load a skill by slug or skill_id, returning its frontmatter and SKILL.md body. Disabled workspace skills are rejected when capabilities are known.",
    inputSchema: {
        type: "object",
        properties: {
            slug: { type: "string", description: "Slug of the skill to load" },
            skill_id: { type: "string", description: "Same as slug (matches executor load_skill)" },
        },
    },
    async run(args = {}) {
        const raw = args.skill_id ?? args.slug;
        const id = raw != null ? String(raw).trim() : "";
        if (!id) throw new Error("load_skill requires slug or skill_id");
        const skill = await loadSkill(id);
        if (!skill) throw new Error(`Skill not found: ${id}`);
        return skill;
    },
};
