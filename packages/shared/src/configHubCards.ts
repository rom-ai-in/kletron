/**
 * Shared configuration hub card definitions (web /app/config and desktop Configuration view).
 * Meta lines are built per-app (dynamic counts, workspace state).
 */
export type ConfigHubIconKey =
  | "folder"
  | "brain"
  | "layers"
  | "messagesSquare"
  | "listTree"
  | "wrench"
  | "link"
  | "puzzle";

export type ConfigHubCardStatic = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: ConfigHubIconKey;
  /** When true, the web hub may show a success border when models are configured. */
  highlightEligible?: boolean;
};

export const CONFIG_HUB_CARDS: readonly ConfigHubCardStatic[] = [
  {
    id: "workspace",
    title: "Workspace",
    description: "Manage MCP repository root.",
    href: "/app/config/workspace",
    icon: "folder",
  },
  {
    id: "aiModels",
    title: "AI Models",
    description: "LLM providers & embedding models.",
    href: "/app/config/llm",
    icon: "brain",
    highlightEligible: true,
  },
  {
    id: "context",
    title: "Context & retrieval",
    description:
      "Overview, structural map, semantic index, injection, and trace — single home for repo context.",
    href: "/app/config/context",
    icon: "layers",
  },
  {
    id: "channels",
    title: "Messenger channels",
    description: "Telegram, Slack, WhatsApp webhooks and identity linking.",
    href: "/app/config/channels",
    icon: "messagesSquare",
  },
  {
    id: "graphs",
    title: "Graphs",
    description: "Edit DAGs, inspect structure, run live executions.",
    href: "/app/agent-graphs",
    icon: "listTree",
  },
  {
    id: "tools",
    title: "Tools",
    description: "Available tools for agents.",
    href: "/app/config/tools",
    icon: "wrench",
  },
  {
    id: "categories",
    title: "Code vs Work",
    description: "How Code and Work modes differ (tools and behavior).",
    href: "/app/config/categories",
    icon: "layers",
  },
  {
    id: "skills",
    title: "Skills",
    description: "AI capabilities as .md files.",
    href: "/app/skills",
    icon: "wrench",
  },
  {
    id: "connectors",
    title: "Connectors",
    description: "External service integrations.",
    href: "/app/config/connectors",
    icon: "link",
  },
  {
    id: "plugins",
    title: "Plugins",
    description: "Cowork-style bundles of skills and connectors.",
    href: "/app/plugins",
    icon: "puzzle",
  },
] as const;
