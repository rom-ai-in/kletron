/**
 * Cowork-style plugins: curated bundles of skill slugs + connector ids.
 * Shared by UI, APIs, and workspace install logic.
 */

import { getConnectorType } from "../connectors/catalog";

export interface PluginDefinition {
    /** Stable id (kebab-case). */
    id: string;
    name: string;
    publisher: string;
    description: string;
    /** Optional marketing / docs link (e.g. claude.com). */
    externalUrl?: string;
    samplePrompts?: string[];
    skillSlugs: string[];
    connectorIds: string[];
}

export const PLUGIN_CATALOG: PluginDefinition[] = [
    {
        id: "figma",
        name: "Figma",
        publisher: "Figma",
        description:
            "Figma design platform integration. Access design files, extract component information, read design tokens, and translate designs into code. Bridge the gap between design and development workflows.",
        externalUrl: "https://www.figma.com",
        samplePrompts: [
            "Turn this frame into React components",
            "Extract design tokens from my selected file",
            "Summarize components used in this page",
        ],
        skillSlugs: [
            "figma-code-connect",
            "figma-create-design-system-rules",
            "figma-create-new-file",
            "figma-generate-design",
            "figma-generate-diagram",
            "figma-generate-library",
            "figma-implement-design",
            "figma-use-figjam",
            "figma-design-tokens",
        ],
        connectorIds: ["figma"],
    },
    {
        id: "productivity",
        name: "Productivity",
        publisher: "Anthropic",
        description:
            "Tasks in TASKS.md, two-tier memory (CLAUDE.md hot cache plus memory/ glossary and profiles), and sync/update flows. Use connectors for calendar, email, chat, and trackers when available.",
        externalUrl: "https://claude.ai",
        samplePrompts: [
            "Set up my task and memory system",
            "Catch me up and triage stale tasks",
            "What's on my plate today?",
            "Remember key context about a project",
        ],
        skillSlugs: ["memory-management", "start", "task-management", "update"],
        connectorIds: [
            "slack",
            "notion",
            "asana",
            "linear",
            "atlassian",
            "ms365",
            "monday",
            "clickup",
            "google-calendar",
            "gmail",
        ],
    },
    {
        id: "enterprise-search",
        name: "Enterprise search",
        publisher: "Anthropic",
        description:
            "Search across email, chat, documents, and wikis from one place. Find anything across connected tools without switching apps when integrations are active.",
        externalUrl: "https://claude.com",
        samplePrompts: [
            "Search across all my company tools at once",
            "Generate a daily activity digest",
            "Find everything related to a specific project",
            "Catch up on what I missed this week",
        ],
        skillSlugs: [
            "digest",
            "knowledge-synthesis",
            "search-strategy",
            "search",
            "source-management",
        ],
        connectorIds: [
            "slack",
            "notion",
            "guru",
            "atlassian",
            "asana",
            "ms365",
            "google-calendar",
            "gmail",
            "sentry",
        ],
    },
    {
        id: "sales",
        name: "Sales",
        publisher: "Anthropic",
        description:
            "Prospect, craft outreach, and build deal strategy faster. Prep for calls, manage your pipeline, and write personalized messaging that moves deals forward.",
        externalUrl: "https://claude.ai",
        samplePrompts: [
            "Prep me for my next sales call",
            "Process my call notes into follow-ups",
            "Review my pipeline for risks and next steps",
            "Research a prospect before outreach",
            "Draft personalized outreach for a prospect",
            "Build a sales forecast with scenario analysis",
        ],
        skillSlugs: [
            "account-research",
            "call-prep",
            "call-summary",
            "competitive-intelligence",
            "create-an-asset",
            "daily-briefing",
            "draft-outreach",
            "forecast",
            "pipeline-review",
        ],
        connectorIds: [
            "slack",
            "hubspot",
            "close",
            "clay",
            "zoominfo",
            "notion",
            "atlassian",
            "fireflies",
            "ms365",
            "apollo",
            "outreach",
            "google-calendar",
            "gmail",
            "similarweb",
        ],
    },
    {
        id: "legal",
        name: "Legal",
        publisher: "Anthropic",
        description:
            "Speed up contract review, NDA triage, and compliance workflows for in-house legal teams. Draft legal briefs, organize precedent research, and manage institutional knowledge.",
        externalUrl: "https://claude.ai",
        samplePrompts: [
            "Review a contract against our playbook",
            "Triage an incoming NDA",
            "Prep a briefing for my next meeting",
            "Assess legal risk on an incoming request",
            "Check existing agreements with a vendor",
        ],
        skillSlugs: [
            "brief",
            "compliance-check",
            "legal-response",
            "legal-risk-assessment",
            "meeting-briefing",
            "review-contract",
            "signature-request",
            "triage-nda",
            "vendor-agreements",
        ],
        connectorIds: [
            "slack",
            "box",
            "egnyte",
            "atlassian",
            "ms365",
            "docusign",
            "google-calendar",
            "gmail",
        ],
    },
    {
        id: "finance",
        name: "Finance",
        publisher: "Anthropic",
        description:
            "Streamline finance and accounting workflows, from journal entries and reconciliation to financial statements and variance analysis. Speed up audit prep, month-end close, and keeping your books clean.",
        externalUrl: "https://claude.ai",
        samplePrompts: [
            "Prepare month-end accrual journal entries",
            "Reconcile GL to subledger balances",
            "Generate an income statement with variance analysis",
            "Analyze what's driving budget variances",
            "Prepare SOX compliance testing workpapers",
            "Walk me through month-end close",
        ],
        skillSlugs: [
            "audit-support",
            "close-management",
            "financial-statements",
            "journal-entry-prep",
            "journal-entry",
            "reconciliation",
            "sox-testing",
            "variance-analysis",
        ],
        connectorIds: [
            "snowflake",
            "databricks",
            "bigquery",
            "slack",
            "ms365",
            "google-calendar",
            "gmail",
        ],
    },
    {
        id: "data",
        name: "Data",
        publisher: "Anthropic",
        description:
            "Write SQL, explore datasets, and generate insights faster. Build visualizations and dashboards, and turn raw data into clear stories for stakeholders.",
        externalUrl: "https://claude.ai",
        samplePrompts: [
            "Explore and profile a dataset",
            "Build an interactive dashboard from my data",
            "Write an optimized SQL query",
            "Map out my data warehouse schema and tables",
            "Run a statistical analysis on my dataset",
        ],
        skillSlugs: [
            "analyze",
            "build-dashboard",
            "create-viz",
            "data-context-extractor",
            "data-visualization",
            "explore-data",
            "sql-queries",
            "statistical-analysis",
            "warehouse-schema",
            "stakeholder-narrative",
        ],
        connectorIds: [
            "snowflake",
            "databricks",
            "bigquery",
            "hex",
            "amplitude",
            "amplitude-eu",
            "atlassian",
            "definite",
        ],
    },
];

const pluginsById = new Map(PLUGIN_CATALOG.map((p) => [p.id, p]));

export function getPlugin(id: string): PluginDefinition | undefined {
    return pluginsById.get(id);
}

export function listPlugins(): PluginDefinition[] {
    return [...PLUGIN_CATALOG];
}

export function validatePluginRefs(plugin: PluginDefinition): { ok: true } | { ok: false; missingConnectors: string[] } {
    const missingConnectors = plugin.connectorIds.filter((cid) => !getConnectorType(cid));
    if (missingConnectors.length > 0) return { ok: false, missingConnectors };
    return { ok: true };
}

/** Union of skill slugs declared by the given installed plugin ids (unknown ids skipped). */
export function collectSkillSlugsFromPluginIds(pluginIds: string[]): Set<string> {
    const out = new Set<string>();
    for (const id of pluginIds) {
        const p = getPlugin(id);
        if (!p) continue;
        for (const slug of p.skillSlugs) out.add(slug);
    }
    return out;
}
