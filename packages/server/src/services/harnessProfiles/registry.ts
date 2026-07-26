import type { HarnessProfile } from "./types";

/**
 * Registry of per-model harness profiles.
 *
 * Lookup walks from the most generic key to the most specific and merges as it
 * goes, so a provider-wide default can be refined by a family and then by an
 * exact model id without repeating shared fields:
 *
 *   "*"  →  "claude:*"  →  "claude:claude-opus-*"  →  "claude:claude-opus-4-5-20251101"
 */
const profiles = new Map<string, HarnessProfile>();

export function registerHarnessProfile(key: string, profile: HarnessProfile): void {
    profiles.set(key.trim().toLowerCase(), profile);
}

/** Exposed for tests. */
export function clearHarnessProfiles(): void {
    profiles.clear();
}

/** Exposed for tests / diagnostics. */
export function registeredHarnessProfileKeys(): string[] {
    return Array.from(profiles.keys()).sort();
}

function mergeProfiles(base: HarnessProfile, override: HarnessProfile): HarnessProfile {
    const merged: HarnessProfile = { ...base };
    for (const [k, v] of Object.entries(override)) {
        if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
    }
    return merged;
}

/**
 * Candidate keys from most generic to most specific.
 *
 * The family key is derived by trimming trailing version/date segments off the
 * model id, so `claude-opus-4-5-20251101` yields `claude-opus-4-5-*`,
 * `claude-opus-4-*` and `claude-opus-*` — a new Opus release inherits the Opus
 * profile on day one instead of silently falling back to the generic default.
 */
export function harnessProfileCandidateKeys(provider: string, model?: string): string[] {
    const p = String(provider ?? "").trim().toLowerCase();
    const m = String(model ?? "").trim().toLowerCase();
    const keys: string[] = ["*"];
    if (!p) return keys;
    keys.push(`${p}:*`);
    if (!m) return keys;

    const segments = m.split("-");
    const families: string[] = [];
    for (let i = 1; i < segments.length; i++) {
        families.push(`${segments.slice(0, i).join("-")}-*`);
    }
    // Shortest (most generic) family first so specific ones override.
    for (const family of families) keys.push(`${p}:${family}`);
    keys.push(`${p}:${m}`);
    return keys;
}

export function resolveHarnessProfile(selection: {
    provider?: string;
    model?: string;
}): HarnessProfile {
    let resolved: HarnessProfile = {};
    for (const key of harnessProfileCandidateKeys(selection.provider ?? "", selection.model)) {
        const hit = profiles.get(key);
        if (hit) resolved = mergeProfiles(resolved, hit);
    }
    return resolved;
}
