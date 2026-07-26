import { registerHarnessProfile } from "../registry";

/**
 * Baseline every other profile refines. Deliberately conservative: an unknown
 * model is assumed not to handle parallel tool calls or subagent orchestration
 * until a profile says otherwise.
 */
export function register(): void {
    registerHarnessProfile("*", {
        maxTaskConcurrency: 0,
        parallelToolCalls: false,
    });
}
