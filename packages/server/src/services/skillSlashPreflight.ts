import { parseSlashCommand } from "./channelSlashParse";
import { resolveWorkspaceSkills } from "./skillsService";
import { resolveWorkspaceAutoLoadSkillSlugs } from "./workspaceSkillStateService";

/**
 * Slash commands that are UI/product reserved — never treated as skill slugs.
 * Keep in sync with built-in entries in the agent composer slash menu (plan, skills, worktree).
 */
export const RUNTIME_RESERVED_SLASH_COMMANDS = new Set([
    "plan",
    "skills",
    "worktree",
]);

/**
 * When the user message starts with `/{slug}` and `slug` matches a workspace-enabled skill,
 * normalize the mission text and return skill id(s) to append to `loadedSkillIds`.
 * Otherwise returns the original message and no ids (no-op).
 */
export async function applySkillSlashPreflight(
    rawMessage: string,
    workspaceId: string
): Promise<{ mission: string; loadedSkillIdsToAppend: string[] }> {
    const trimmed = rawMessage.trim();
    const { cmd, rest, isSlash } = parseSlashCommand(trimmed);
    if (!isSlash || !cmd) {
        return { mission: rawMessage, loadedSkillIdsToAppend: [] };
    }
    if (RUNTIME_RESERVED_SLASH_COMMANDS.has(cmd)) {
        return { mission: rawMessage, loadedSkillIdsToAppend: [] };
    }

    const enabled = await resolveWorkspaceSkills(workspaceId);
    const enabledSlugs = new Set(enabled.map((s) => s.slug));
    if (!enabledSlugs.has(cmd)) {
        return { mission: rawMessage, loadedSkillIdsToAppend: [] };
    }

    const restTrim = rest.trim();
    const mission = restTrim.length > 0 ? restTrim : trimmed;
    return { mission, loadedSkillIdsToAppend: [cmd] };
}

/** Merge slash-derived ids into existing loaded list (dedupe, preserve order). */
export function mergeLoadedSkillIds(
    existing: string[] | undefined,
    toAppend: string[]
): string[] {
    const out: string[] = [...(existing ?? [])];
    const seen = new Set(out);
    for (const id of toAppend) {
        if (!seen.has(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}

/** Fields to merge into run state after `buildInitialState` for first-turn slash skill loading. */
export type SkillPreflightStatePatch = {
    mission: string;
    loadedSkillIds: string[];
    skillLoads: Array<{ slug: string; at: string; reason?: string }>;
};

/**
 * Async preflight for new runs: normalizes mission and computes initial loaded skills + audit entries.
 */
export async function preflightMissionForNewRun(
    rawMission: string,
    workspaceId: string
): Promise<SkillPreflightStatePatch> {
    const [autoLoadSkillIds, { mission, loadedSkillIdsToAppend }] = await Promise.all([
        resolveWorkspaceAutoLoadSkillSlugs(workspaceId),
        applySkillSlashPreflight(rawMission, workspaceId),
    ]);
    const slashSkillIds = loadedSkillIdsToAppend.filter((slug) => !autoLoadSkillIds.includes(slug));
    const loadedSkillIds = mergeLoadedSkillIds(
        mergeLoadedSkillIds(undefined, autoLoadSkillIds),
        slashSkillIds,
    );
    const skillLoads = [
        ...autoLoadSkillIds.map((slug) => ({
            slug,
            at: new Date().toISOString(),
            reason: "workspace_autoload" as const,
        })),
        ...slashSkillIds.map((slug) => ({
        slug,
        at: new Date().toISOString(),
        reason: "slash_preflight" as const,
        })),
    ];
    return {
        mission,
        loadedSkillIds,
        skillLoads,
    };
}
