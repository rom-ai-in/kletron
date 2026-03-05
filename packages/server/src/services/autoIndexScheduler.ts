import { getDirtyFiles } from "./autoIndexer";
import { startIndexing } from "./indexerService";
import { acquireLock, releaseLock } from "./lockService";
import fs from "node:fs";

type SchedulerState = {
    pendingRun: boolean;
    lastRun: Date | null;
    isRunning: boolean;
};

const LOCK_NAME = "auto-indexer";
const stateMap = new Map<string, SchedulerState>();

// Run every 10 minutes
export const INTERVAL_MS = 10 * 60 * 1000;

function getState(workspaceId: string): SchedulerState {
    const existing = stateMap.get(workspaceId);
    if (existing) return existing;
    const state: SchedulerState = { pendingRun: false, lastRun: null, isRunning: false };
    stateMap.set(workspaceId, state);
    return state;
}

export function getSchedulerStatus(workspaceId: string) {
    const state = getState(workspaceId);
    return {
        intervalMs: INTERVAL_MS,
        lastRun: state.lastRun,
        isRunning: state.isRunning,
        pendingRun: state.pendingRun
    };
}

const schedulerMap = new Map<string, { interval: NodeJS.Timeout | null; initTimeout: NodeJS.Timeout | null }>();

export function startAutoIndexScheduler(workspaceId: string, repoPath: string) {
    stopAutoIndexScheduler(workspaceId);
    // Initial delay to let server start up
    const entry = schedulerMap.get(workspaceId) || { interval: null, initTimeout: null };
    entry.initTimeout = setTimeout(() => {
        scheduleNextRun(workspaceId, repoPath);
    }, 10000);
    schedulerMap.set(workspaceId, entry);
}

export function stopAutoIndexScheduler(workspaceId?: string) {
    if (workspaceId) {
        const entry = schedulerMap.get(workspaceId);
        if (entry?.initTimeout) {
            clearTimeout(entry.initTimeout);
            entry.initTimeout = null;
        }
        if (entry?.interval) {
            clearInterval(entry.interval);
            entry.interval = null;
        }
        schedulerMap.delete(workspaceId);
        return;
    }

    for (const [id, entry] of schedulerMap.entries()) {
        if (entry.initTimeout) {
            clearTimeout(entry.initTimeout);
        }
        if (entry.interval) {
            clearInterval(entry.interval);
        }
        schedulerMap.delete(id);
    }
}

function scheduleNextRun(workspaceId: string, repoPath: string) {
    const entry = schedulerMap.get(workspaceId) || { interval: null, initTimeout: null };
    entry.interval = setInterval(async () => {
        await runAutoIndex(workspaceId, repoPath);
    }, INTERVAL_MS);
    schedulerMap.set(workspaceId, entry);
}

export async function runAutoIndex(workspaceId: string, repoPath: string) {
    if (!fs.existsSync(repoPath)) {
        console.warn(`[AutoIndex] Skipping run for missing workspace path: ${repoPath}`);
        return;
    }
    const state = getState(workspaceId);
    const dirty = getDirtyFiles(workspaceId);
    if (dirty.length === 0) {
        // No changes, nothing to do
        return;
    }

    // Try to acquire lock
    // Use a shorter TTL since we expect runs to be incremental and fast
    const gotLock = await acquireLock(`${LOCK_NAME}:${workspaceId}`, 5 * 60 * 1000); // 5 min TTL

    if (!gotLock) {
        console.log("[AutoIndex] Lock held by another process, marking pending run.");
        state.pendingRun = true;
        return;
    }

    state.isRunning = true;
    try {
        console.log(`[AutoIndex] Starting incremental index for ${dirty.length} files...`);
        // We pass the dirty list to startIndexing for incremental mode
        await startIndexing(workspaceId, repoPath, false, dirty);
        state.lastRun = new Date();
        console.log(`[AutoIndex] Completed incremental index.`);
    } catch (e) {
        console.error("[AutoIndex] Error during scheduled run:", e);
    } finally {
        state.isRunning = false;
        await releaseLock(`${LOCK_NAME}:${workspaceId}`);

        // If pending run flag was set while we were working, trigger another run immediately
        // (but check dirty files first inside the recursive call logic loop - 
        // actually simplest is just to clear pending and let the next buffer accumulate, 
        // OR we can force a check now if we think meaningful changes happened.)

        // Simpler: If pendingRun is true, it means we missed a cycle or had contention.
        // But since we just cleared dirtyFiles at start of this function, 
        // new dirty files would be in the set now.
        // So we can just check if there are new dirty files.
        // We don't strictly need 'pendingRun' with the getDirtyFiles() mechanics, 
        // but it's good for ensuring we don't drop the 'intent' to run if we were locked out.

        if (state.pendingRun) {
            state.pendingRun = false;
            // Immediate retry if we were blocked? 
            // Better to just let the next interval handle it, 
            // OR checks immediately if we have accumulated more work.
            const moreDirty = getDirtyFiles(workspaceId);
            if (moreDirty.length > 0) {
                // Put them back? Or just run.
                // Re-queue them implies we need to be careful.
                // Let's just run again immediately.
                // We need to 'put back' the files we just popped if we are calling runAutoIndex again... 
                // Wait, getDirtyFiles CLEARS the list. 
                // So if we call runAutoIndex, it will see the NEW dirty files that came in during the lock.
                // That is correct behavior.
                setTimeout(() => void runAutoIndex(workspaceId, repoPath), 1000);
            }
        }
    }
}
