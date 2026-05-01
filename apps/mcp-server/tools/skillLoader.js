// MCP tools that expose the skills library to the agent.
// `list_skills` returns the catalog (built-in + user). `load_skill` returns a
// resolved skill (frontmatter + body) which a node can splice into its system
// prompt.

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
export const list_skills = {
    description: "List all skills available in the Kletron library (built-in + user).",
    inputSchema: { type: "object", properties: {} },
    async run() {
        return listSkills();
    },
};

export const load_skill = {
    description: "Load a skill by slug, returning its frontmatter and SKILL.md body.",
    inputSchema: {
        type: "object",
        properties: {
            slug: { type: "string", description: "Slug of the skill to load" },
        },
        required: ["slug"],
    },
    async run({ slug }) {
        const skill = await loadSkill(slug);
        if (!skill) throw new Error(`Skill not found: ${slug}`);
        return skill;
    },
};
