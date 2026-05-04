// Built-in connector type catalog.
// Each entry describes a SaaS integration that can be connected per workspace,
// the auth mechanism the user goes through, and the MCP tools it unlocks
// when an active integration is present for that workspace.
//
// This module is shared between the UI (catalog page) and the runtime
// resolver, so adding a new provider is a one-file change.

export type ConnectorAuthMethod = "oauth" | "api_key" | "manual";

export type ConnectorCategory =
    | "code"
    | "communication"
    | "knowledge"
    | "storage"
    | "billing"
    | "productivity"
    | "other";

export interface ConnectorCredentialField {
    /** Field key stored in the (encrypted) credentials object. */
    key: string;
    /** Human label shown in the UI. */
    label: string;
    /** Brief help text. */
    help?: string;
    /** Whether the field is masked in the UI (passwords / secrets). */
    secret?: boolean;
    /** Whether this field is required. */
    required?: boolean;
    /** Optional placeholder for the input. */
    placeholder?: string;
}

export interface ConnectorTypeDefinition {
    /** Stable id used as `providerId` on workspace integrations. */
    id: string;
    name: string;
    description: string;
    category: ConnectorCategory;
    icon?: string;
    /** Auth flow used to obtain credentials. */
    auth: ConnectorAuthMethod;
    /** OAuth scopes requested when auth = 'oauth'. */
    oauthScopes?: string[];
    /** Required credential fields when auth = 'api_key' or 'manual'. */
    credentialFields?: ConnectorCredentialField[];
    /**
     * MCP tool names that become available (in the bundled MCP server) when
     * an active integration of this type exists for a workspace.
     */
    unlocksTools: string[];
    /** Documentation URL surfaced in the UI. */
    docsUrl?: string;
}

export const CONNECTOR_CATALOG: ConnectorTypeDefinition[] = [
    {
        id: "github",
        name: "GitHub",
        description: "Connect a GitHub account to enable repo browsing, PRs, and git tooling.",
        category: "code",
        icon: "github",
        auth: "oauth",
        oauthScopes: ["read:user", "repo"],
        credentialFields: [
            {
                key: "token",
                label: "Personal Access Token",
                help: "Use a fine-grained PAT scoped to the repos you want Kletron to access.",
                secret: true,
                required: true,
                placeholder: "ghp_xxxxxxxxxxxxxxxx",
            },
        ],
        unlocksTools: [
            "github_api",
            "git_diff",
            "git_grep",
            "git_log",
            "git_blame",
        ],
        docsUrl: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
    },
    {
        id: "slack",
        name: "Slack",
        description: "Read channels, search messages, and send notifications via Slack.",
        category: "communication",
        icon: "slack",
        auth: "oauth",
        oauthScopes: ["channels:read", "chat:write", "users:read"],
        credentialFields: [
            {
                key: "botToken",
                label: "Bot User OAuth Token",
                secret: true,
                required: true,
                placeholder: "xoxb-...",
            },
        ],
        unlocksTools: ["notify"],
        docsUrl: "https://api.slack.com/authentication/token-types",
    },
    {
        id: "notion",
        name: "Notion",
        description: "Read and write Notion pages and databases.",
        category: "knowledge",
        icon: "notion",
        auth: "api_key",
        credentialFields: [
            {
                key: "apiKey",
                label: "Internal Integration Token",
                secret: true,
                required: true,
                placeholder: "secret_...",
            },
        ],
        unlocksTools: ["fetch_url", "web_search"],
        docsUrl: "https://www.notion.so/help/create-integrations-with-the-notion-api",
    },
    {
        id: "guru",
        name: "Guru",
        description:
            "Search company cards, collections, and verified answers. Use alongside Notion and Confluence for unified enterprise knowledge discovery.",
        category: "knowledge",
        icon: "book-open",
        auth: "api_key",
        credentialFields: [
            {
                key: "apiKey",
                label: "API token",
                help: "User or collection token from Guru developer settings.",
                secret: true,
                required: true,
            },
        ],
        unlocksTools: ["fetch_url", "web_search"],
        docsUrl: "https://developer.getguru.com/",
    },
    {
        id: "linear",
        name: "Linear",
        description: "Manage issues and projects via Linear.",
        category: "productivity",
        icon: "linear",
        auth: "api_key",
        credentialFields: [
            {
                key: "apiKey",
                label: "Personal API Key",
                secret: true,
                required: true,
                placeholder: "lin_api_...",
            },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developers.linear.app/docs/graphql/working-with-the-graphql-api",
    },
    {
        id: "stripe",
        name: "Stripe",
        description: "Query Stripe subscriptions, invoices, and billing data.",
        category: "billing",
        icon: "stripe",
        auth: "api_key",
        credentialFields: [
            {
                key: "secretKey",
                label: "Secret Key",
                secret: true,
                required: true,
                placeholder: "sk_live_... or sk_test_...",
            },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://stripe.com/docs/keys",
    },
    {
        id: "google-drive",
        name: "Google Drive",
        description: "Read, inspect metadata, and manage documents, sheets, and slides in Google Drive.",
        category: "storage",
        icon: "google-drive",
        auth: "oauth",
        oauthScopes: [
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
        ],
        credentialFields: [
            {
                key: "refreshToken",
                label: "OAuth Refresh Token",
                secret: true,
                required: true,
            },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developers.google.com/drive/api/guides/about-auth",
    },
    {
        id: "figma",
        name: "Figma",
        description: "Access Figma files, components, and design tokens via API.",
        category: "productivity",
        icon: "figma",
        auth: "api_key",
        credentialFields: [
            {
                key: "accessToken",
                label: "Personal access token",
                secret: true,
                required: true,
                placeholder: "figd_...",
            },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://www.figma.com/developers/api",
    },
    {
        id: "asana",
        name: "Asana",
        description: "Tasks, projects, and workload visibility.",
        category: "productivity",
        auth: "api_key",
        credentialFields: [
            { key: "apiKey", label: "Personal Access Token", secret: true, required: true },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developers.asana.com/docs",
    },
    {
        id: "atlassian",
        name: "Atlassian (Jira / Confluence)",
        description: "Issues, pages, and workspace search.",
        category: "productivity",
        auth: "api_key",
        credentialFields: [
            { key: "apiToken", label: "API token", secret: true, required: true },
            { key: "email", label: "Atlassian account email", required: true },
            { key: "siteUrl", label: "Site URL (e.g. your-org.atlassian.net)", required: true },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developer.atlassian.com/cloud/jira/platform/rest/v3/",
    },
    {
        id: "ms365",
        name: "Microsoft 365",
        description: "Outlook, Teams, and Microsoft Graph workloads.",
        category: "productivity",
        auth: "oauth",
        oauthScopes: ["User.Read", "Mail.Read"],
        credentialFields: [
            { key: "refreshToken", label: "OAuth refresh token", secret: true, required: true },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://learn.microsoft.com/en-us/graph/overview",
    },
    {
        id: "monday",
        name: "Monday.com",
        description: "Boards, items, and automations.",
        category: "productivity",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "API token", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developer.monday.com/api-reference",
    },
    {
        id: "clickup",
        name: "ClickUp",
        description: "Tasks, docs, and goals.",
        category: "productivity",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "Personal API token", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://clickup.com/api",
    },
    {
        id: "google-calendar",
        name: "Google Calendar",
        description: "Read and manage calendar events and availability.",
        category: "productivity",
        auth: "oauth",
        oauthScopes: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/calendar.freebusy",
        ],
        credentialFields: [
            { key: "refreshToken", label: "OAuth refresh token", secret: true, required: true },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developers.google.com/calendar/api/guides/overview",
    },
    {
        id: "gmail",
        name: "Gmail",
        description: "Read, organize, draft, and send mail via Google APIs.",
        category: "communication",
        auth: "oauth",
        oauthScopes: [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.metadata",
        ],
        credentialFields: [
            { key: "refreshToken", label: "OAuth refresh token", secret: true, required: true },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developers.google.com/gmail/api/guides",
    },
    {
        id: "hubspot",
        name: "HubSpot",
        description: "CRM contacts, deals, and sequences.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "accessToken", label: "Private app access token", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developers.hubspot.com/docs/api/overview",
    },
    {
        id: "close",
        name: "Close",
        description: "Sales CRM leads and opportunities.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "API key", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developer.close.com/",
    },
    {
        id: "clay",
        name: "Clay",
        description: "Enrichment and outbound workflows.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "API key", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://www.clay.com/university/guide/how-to-use-apis-and-http-requests-in-clay",
    },
    {
        id: "zoominfo",
        name: "ZoomInfo",
        description: "B2B contact and company data.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "username", label: "Username", required: true }, { key: "password", label: "Password", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developer.zoominfo.com/",
    },
    {
        id: "fireflies",
        name: "Fireflies",
        description: "Meeting transcripts and summaries.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "API key", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://docs.fireflies.ai/",
    },
    {
        id: "apollo",
        name: "Apollo",
        description: "Prospecting and engagement data.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "API key", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://apolloio.github.io/apollo-api-docs/",
    },
    {
        id: "outreach",
        name: "Outreach",
        description: "Sales engagement platform.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "accessToken", label: "OAuth access token", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developers.outreach.io/",
    },
    {
        id: "similarweb",
        name: "Similarweb",
        description: "Digital market intelligence.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "API key", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developer.similarweb.com/",
    },
    {
        id: "box",
        name: "Box",
        description: "Enterprise content cloud.",
        category: "storage",
        auth: "oauth",
        credentialFields: [{ key: "accessToken", label: "OAuth access token", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developer.box.com/",
    },
    {
        id: "egnyte",
        name: "Egnyte",
        description: "Secure file collaboration.",
        category: "storage",
        auth: "api_key",
        credentialFields: [{ key: "accessToken", label: "OAuth access token", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developers.egnyte.com/",
    },
    {
        id: "docusign",
        name: "DocuSign",
        description: "E-signatures and agreement workflows.",
        category: "other",
        auth: "oauth",
        credentialFields: [{ key: "accessToken", label: "OAuth access token", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://developers.docusign.com/",
    },
    {
        id: "snowflake",
        name: "Snowflake",
        description: "Cloud data warehouse queries and metadata.",
        category: "other",
        auth: "manual",
        credentialFields: [
            { key: "account", label: "Account identifier", required: true },
            { key: "user", label: "User", required: true },
            { key: "password", label: "Password", secret: true, required: true },
            { key: "warehouse", label: "Warehouse", required: false },
            { key: "database", label: "Database", required: false },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://docs.snowflake.com/",
    },
    {
        id: "databricks",
        name: "Databricks",
        description: "Lakehouse SQL and notebooks.",
        category: "other",
        auth: "api_key",
        credentialFields: [
            { key: "host", label: "Workspace URL", required: true, placeholder: "https://xxx.cloud.databricks.com" },
            { key: "token", label: "Personal access token", secret: true, required: true },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://docs.databricks.com/dev-tools/api/latest/index.html",
    },
    {
        id: "bigquery",
        name: "BigQuery",
        description: "Google Cloud analytics warehouse.",
        category: "other",
        auth: "manual",
        credentialFields: [
            { key: "projectId", label: "Project ID", required: true },
            { key: "credentialsJson", label: "Service account JSON", secret: true, required: true },
        ],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://cloud.google.com/bigquery/docs",
    },
    {
        id: "hex",
        name: "Hex",
        description: "Collaborative analytics notebooks.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "API key", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://learn.hex.tech/docs/api/overview/",
    },
    {
        id: "amplitude",
        name: "Amplitude",
        description: "Product analytics and behavioral data.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "API key / secret", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://www.docs.developers.amplitude.com/",
    },
    {
        id: "amplitude-eu",
        name: "Amplitude (EU)",
        description: "Amplitude EU data residency endpoints.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "API key / secret", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://www.docs.developers.amplitude.com/",
    },
    {
        id: "definite",
        name: "Definite",
        description: "Analytics and metrics stack integrations.",
        category: "other",
        auth: "api_key",
        credentialFields: [{ key: "apiKey", label: "API key", secret: true, required: true }],
        unlocksTools: ["fetch_url"],
        docsUrl: "https://www.definite.app/",
    },
];

const catalogById = new Map(CONNECTOR_CATALOG.map((c) => [c.id, c]));

export function getConnectorType(id: string): ConnectorTypeDefinition | undefined {
    return catalogById.get(id);
}

export function listConnectorTypes(): ConnectorTypeDefinition[] {
    return [...CONNECTOR_CATALOG];
}

/**
 * Compute the set of MCP tool names unlocked by the given connector ids.
 */
export function toolsUnlockedByConnectors(providerIds: string[]): string[] {
    const tools = new Set<string>();
    for (const id of providerIds) {
        const def = catalogById.get(id);
        if (!def) continue;
        for (const tool of def.unlocksTools) tools.add(tool);
    }
    return Array.from(tools);
}
