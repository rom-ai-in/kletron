import { getDirtyFiles } from "./autoIndexer";
import { startIndexing } from "./indexerService";
import { acquireLock, releaseLock } from "./lockService";

let pendingRun = false;
const LOCK_NAME = "auto-indexer";

// Run every 10 minutes
const INTERVAL_MS = 10 * 60 * 1000;

export function startAutoIndexScheduler(repoPath: string) {
    // Initial delay to let server start up
    setTimeout(() => {
        scheduleNextRun(repoPath);
    }, 10000);
}

function scheduleNextRun(repoPath: string) {
    setInterval(async () => {
        await runAutoIndex(repoPath);
    }, INTERVAL_MS);
}

export async function runAutoIndex(repoPath: string) {
    const dirty = getDirtyFiles();
    if (dirty.length === 0) {
        // No changes, nothing to do
        return;
    }

    // Try to acquire lock
    // Use a shorter TTL since we expect runs to be incremental and fast
    const gotLock = await acquireLock(LOCK_NAME, 5 * 60 * 1000); // 5 min TTL

    if (!gotLock) {
        console.log("[AutoIndex] Lock held by another process, marking pending run.");
        pendingRun = true;
        return;
    }

    try {
        console.log(`[AutoIndex] Starting incremental index for ${dirty.length} files...`);
        // We pass the dirty list to startIndexing for incremental mode
        await startIndexing(repoPath, false, dirty);
        console.log(`[AutoIndex] Completed incremental index.`);
    } catch (e) {
        console.error("[AutoIndex] Error during scheduled run:", e);
    } finally {
        await releaseLock(LOCK_NAME);

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

        if (pendingRun) {
            pendingRun = false;
            // Immediate retry if we were blocked? 
            // Better to just let the next interval handle it, 
            // OR checks immediately if we have accumulated more work.
            const moreDirty = getDirtyFiles();
            if (moreDirty.length > 0) {
                // Put them back? Or just run.
                // Re-queue them implies we need to be careful.
                // Let's just run again immediately.
                // We need to 'put back' the files we just popped if we are calling runAutoIndex again... 
                // Wait, getDirtyFiles CLEARS the list. 
                // So if we call runAutoIndex, it will see the NEW dirty files that came in during the lock.
                // That is correct behavior.
                setTimeout(() => void runAutoIndex(repoPath), 1000);
            }
        }
    }
}
