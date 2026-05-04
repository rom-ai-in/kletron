export type SlashCommandSectionId = "skills" | "commands";

/** Strip leading `/` and trim for matching user input against commands. */
export function normalizeSlashQuery(filter: string): string {
  return filter.toLowerCase().replace(/^\//, "").trim();
}

export function slashItemMatchesQuery(
  item: { id: string; label: string; description?: string },
  query: string
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.label.toLowerCase().includes(q) ||
    item.id.toLowerCase().includes(q) ||
    (item.description?.toLowerCase().includes(q) ?? false)
  );
}

/** Filter slash palette items by the current composer text (after `/`). */
export function filterSlashCommandItems<T extends { id: string; label: string; description?: string }>(
  items: T[],
  filter: string
): T[] {
  const query = normalizeSlashQuery(filter);
  return items.filter((item) => slashItemMatchesQuery(item, query));
}

export const SLASH_SECTION_ORDER: SlashCommandSectionId[] = ["skills", "commands"];

export const SLASH_SECTION_LABEL: Record<SlashCommandSectionId, string> = {
  skills: "Skills",
  commands: "Commands",
};

/** Default section when `sectionId` is omitted (legacy items). */
export function resolveSlashSectionId(sectionId?: SlashCommandSectionId): SlashCommandSectionId {
  return sectionId ?? "commands";
}
