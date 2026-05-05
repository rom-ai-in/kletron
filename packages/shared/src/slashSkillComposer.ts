/** Matches kebab-case skill slugs after a leading `/` (aligned with SLUG_REGEX in skills types). */
const LEADING_SLASH_SKILL = /^\/([a-z0-9][a-z0-9-]*)(\s+|$)/;

/**
 * Peel repeated `/slug` tokens from the start of the composer text (manual typing).
 */
export function stripLeadingSlashSkillSlugs(text: string): { slugs: string[]; rest: string } {
    const slugs: string[] = [];
    let s = text.trimStart();
    for (;;) {
        const m = s.match(LEADING_SLASH_SKILL);
        if (!m) break;
        slugs.push(m[1]);
        s = s.slice(m[0].length);
    }
    return { slugs, rest: s };
}

/**
 * Slash skills shown as chips use ids `skill:${slug}` (see {@link createSkillChip} in UI).
 * Compose the wire message: `/slug1 /slug2 …` plus body. Merges palette chips with leading `/slug`
 * tokens typed in the textarea (deduped, chips first).
 */
export function composeMessageWithSlashSkillChips(
    bodyTrimmed: string,
    chips: ReadonlyArray<{ id: string }>,
): string {
    const fromChips = chips
        .filter((c) => c.id.startsWith('skill:'))
        .map((c) => c.id.slice('skill:'.length));
    const { slugs: fromDraft, rest } = stripLeadingSlashSkillSlugs(bodyTrimmed);
    const merged: string[] = [...fromChips];
    for (const s of fromDraft) {
        if (!merged.includes(s)) merged.push(s);
    }
    if (merged.length === 0) return bodyTrimmed;
    const prefix = merged.map((s) => `/${s}`).join(' ');
    const tail = rest.trim();
    return tail ? `${prefix} ${tail}` : prefix;
}
