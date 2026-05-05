/**
 * User-facing copy for agent tools that graphs request but the workspace does not expose
 * (capabilities / connectors / skills). Keeps snake_case internal names out of primary UI.
 */

const KNOWN_LABELS: Record<string, string> = {
  web_search: "Web search",
  fetch_url: "Opening web pages",
  github_api: "GitHub",
  sentry_api: "Sentry",
  notify: "Slack notifications",
};

export function humanizeCapabilityToolName(toolName: string): string {
  const known = KNOWN_LABELS[toolName];
  if (known) return known;
  return toolName
    .split(/_/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Natural-language list for inline sentences, e.g. "Web search and Opening web pages". */
export function formatDroppedToolsListPhrase(toolNames: readonly string[]): string {
  const labels = toolNames.map(humanizeCapabilityToolName);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]!}`;
}

/** Tooltip / title string: "Web search, Opening web pages". */
export function formatDroppedToolsTooltipList(toolNames: readonly string[]): string {
  return toolNames.map(humanizeCapabilityToolName).join(", ");
}

/**
 * Banner sentence tail (after the highlighted tool list). Keep web, desktop, and popout in sync.
 */
export const CAPABILITY_DROPPED_BANNER_TAIL =
  ", which aren't turned on for this workspace yet. Enable them under Connectors or Skills (opens in browser). Hide this note — use Limited tools below to show it again.";

/** Compact CTA label when the full banner is dismissed. */
export const CAPABILITY_DROPPED_SLIM_CTA_LABEL = "Limited tools — show setup";

/** `title` attribute for the slim CTA button. */
export function capabilityDroppedSlimBarTitle(toolNames: readonly string[]): string {
  return `Some tools aren't enabled: ${formatDroppedToolsTooltipList(toolNames)}. Click for Connectors / Skills links.`;
}
