// src/workModePreference.ts
// One definition of the per-workspace Work/Code preference key, so the primary
// sidebar and the agent page can't drift apart on where the mode is stored.

import { normalizeToWorkModeId, type WorkModeId } from './workMode';

/** Work is the product default; Code is opt-in. */
export const DEFAULT_WORK_MODE: WorkModeId = 'work';

export function workModeStorageKey(workspaceId: string): string {
    return `kletron-work-mode-${workspaceId}`;
}

/** Last mode the user picked for this workspace, or null when nothing is stored. */
export function readWorkModePreference(workspaceId: string | null | undefined): WorkModeId | null {
    if (!workspaceId || typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(workModeStorageKey(workspaceId));
        return raw ? normalizeToWorkModeId(raw) : null;
    } catch {
        return null;
    }
}

export function writeWorkModePreference(
    workspaceId: string | null | undefined,
    mode: WorkModeId,
): void {
    if (!workspaceId || typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(workModeStorageKey(workspaceId), mode);
    } catch {
        /* private browsing / quota — display falls back to the default */
    }
}
