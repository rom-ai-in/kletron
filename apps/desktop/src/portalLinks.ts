/**
 * Web app paths opened via `openPortalPath` (same origin as backend URL).
 * The host configured as the desktop backend must serve the Next app for `/app/*`.
 */
export type PortalLinkItem = { label: string; path: string; description?: string };

export const PORTAL_LINK_GROUPS: Array<{ title: string; items: PortalLinkItem[] }> = [
  {
    title: "Account & organization",
    items: [
      { label: "Account", path: "/app/account", description: "Profile and preferences" },
      { label: "Billing", path: "/app/account/billing" },
      { label: "Organization", path: "/app/organization" },
      { label: "Members", path: "/app/organization/members" },
    ],
  },
  {
    title: "Workspace & configuration",
    items: [
      { label: "Configuration hub", path: "/app/config" },
      { label: "Workspace", path: "/app/config/workspace" },
      { label: "Connectors", path: "/app/config/connectors" },
      { label: "LLM & models", path: "/app/config/llm" },
      { label: "Tools", path: "/app/config/tools" },
      { label: "Channels", path: "/app/config/channels" },
      { label: "Embeddings", path: "/app/config/embeddings" },
      { label: "Context", path: "/app/config/context" },
    ],
  },
  {
    title: "Activity",
    items: [{ label: "Full history", path: "/app/history", description: "Runs, graphs, automations, drift" }],
  },
];
