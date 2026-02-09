/**
 * AutomationScheduler — Background service that polls for scheduled automations
 * and triggers execution when they are due.
 *
 * Modeled after autoIndexScheduler.ts. Runs as a singleton with a 60-second poll interval.
 */

import { automationExecutor } from "./automationExecutor";
import { acquireLock, releaseLock } from "./lockService";

const LOCK_PREFIX = "automation-scheduler";
const POLL_INTERVAL_MS = 60_000; // 60 seconds

type SchedulerState = {
    isRunning: boolean;
    lastPoll: Date | null;
    executionsTriggered: number;
};

const state: SchedulerState = {
    isRunning: false,
    lastPoll: null,
    executionsTriggered: 0,
};

let pollInterval: NodeJS.Timeout | null = null;
let initTimeout: NodeJS.Timeout | null = null;

/**
 * Start the automation scheduler.
 * Adds a short delay to let the server fully initialize before the first poll.
 */
export function startAutomationScheduler(): void {
    stopAutomationScheduler();

    console.log("[AutomationScheduler] Starting scheduler...");

    // Delay first poll by 15 seconds to let the server stabilize
    initTimeout = setTimeout(() => {
        // Run immediately, then schedule recurring polls
        void pollScheduledAutomations();
        pollInterval = setInterval(() => {
            void pollScheduledAutomations();
        }, POLL_INTERVAL_MS);
    }, 15_000);
}

/**
 * Stop the automation scheduler and clean up timers.
 */
export function stopAutomationScheduler(): void {
    if (initTimeout) {
        clearTimeout(initTimeout);
        initTimeout = null;
    }
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

/**
 * Get the current scheduler status (for diagnostics).
 */
export function getAutomationSchedulerStatus() {
    return {
        pollIntervalMs: POLL_INTERVAL_MS,
        isRunning: state.isRunning,
        lastPoll: state.lastPoll,
        executionsTriggered: state.executionsTriggered,
    };
}

/**
 * Core poll loop: find due automations and trigger them.
 */
async function pollScheduledAutomations(): Promise<void> {
    if (state.isRunning) {
        // Previous poll still in progress — skip
        return;
    }

    state.isRunning = true;
    state.lastPoll = new Date();

    try {
        const dueAutomations = await automationExecutor.listDueScheduledAutomations();

        if (dueAutomations.length === 0) {
            return;
        }

        console.log(`[AutomationScheduler] Found ${dueAutomations.length} due automation(s).`);

        for (const automation of dueAutomations) {
            const automationId = automation._id?.toString();
            if (!automationId) continue;

            const lockName = `${LOCK_PREFIX}:${automationId}`;

            // Acquire a distributed lock to prevent double-triggering
            const gotLock = await acquireLock(lockName, 10 * 60 * 1000); // 10 min TTL
            if (!gotLock) {
                console.log(`[AutomationScheduler] Lock held for automation ${automationId}, skipping.`);
                continue;
            }

            try {
                // Re-check: the automation may have been triggered by another process
                const fresh = await automationExecutor.getAutomation(automationId);
                if (
                    !fresh ||
                    fresh.triggerType !== "schedule" ||
                    !fresh.schedule?.enabled
                ) {
                    continue;
                }

                // Check maxRuns
                if (
                    fresh.schedule.maxRuns &&
                    (fresh.schedule.executionCount ?? 0) >= fresh.schedule.maxRuns
                ) {
                    console.info(
                        `[AutomationScheduler] Automation ${automationId} already at maxRuns (${fresh.schedule.maxRuns}), disabling.`
                    );
                    await automationExecutor.incrementScheduleCount(automationId);
                    continue;
                }

                // Check if nextScheduledAt is actually due
                const nextRun = fresh.schedule.nextScheduledAt;
                if (nextRun && new Date(nextRun).getTime() > Date.now()) {
                    continue;
                }

                console.log(`[AutomationScheduler] Triggering automation ${automationId} (${fresh.name})`);

                // Increment schedule count (updates lastScheduledAt, computes nextScheduledAt)
                await automationExecutor.incrementScheduleCount(automationId);

                // Start a new run in background
                const workspaceId = fresh.workspaceId?.toString();
                const runId = await automationExecutor.startNewRun(automationId, workspaceId);

                // Execute run without awaiting (fire-and-forget)
                automationExecutor.executeRun(runId).catch((error) => {
                    console.error(
                        `[AutomationScheduler] Run ${runId} (automation ${automationId}) failed:`,
                        error
                    );
                });

                state.executionsTriggered++;
            } catch (error) {
                console.error(
                    `[AutomationScheduler] Error processing automation ${automationId}:`,
                    error
                );
            } finally {
                await releaseLock(lockName);
            }
        }
    } catch (error) {
        console.error("[AutomationScheduler] Poll error:", error);
    } finally {
        state.isRunning = false;
    }
}
