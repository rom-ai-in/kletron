import { registerHarnessProfile } from "../registry";

/**
 * Codex runs through its own execution backend (`codexExecutionService`), which
 * owns prompting and the tool loop. Only the budgets are meaningful here — a
 * prompt suffix from this layer would not reach it.
 */
export function register(): void {
    registerHarnessProfile("codex:*", {
        recursionLimit: 140,
        maxTaskConcurrency: 0,
        parallelToolCalls: true,
    });
}
