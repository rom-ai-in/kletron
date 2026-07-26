import { registerHarnessProfile } from "../registry";

/**
 * Shared harness for frontier models — those that reliably plan, emit several
 * independent tool calls per turn, and can orchestrate subagents.
 *
 * Kept short on purpose. These models already investigate before answering; the
 * suffix exists to make the *harness-specific* affordances explicit (parallel
 * calls, when delegation is and is not worth it), not to re-teach them how to
 * think.
 */
const FRONTIER_SUFFIX = `## Harness

**Parallel tool calls.** When several tool calls are independent, emit them in the same turn rather than one per turn. Reading four files is one turn with four calls, not four turns. Only sequence calls when a later one genuinely needs an earlier one's output.

**Investigate before answering.** Never describe code you have not opened. If the user names a file, read it. Search before asserting that a symbol does or does not exist.

**Reflect on tool results.** After a batch of results comes back, take stock of what actually changed in your understanding before firing the next batch.

**Delegation.** Do not spawn a subagent for work you can finish in this turn. Delegate when the work is genuinely separable — a distinct area to map, an independent question to answer, a claim to verify — and when you do, emit all the independent \`task\` calls together so they run in parallel.`;

export function register(): void {
    for (const provider of ["claude", "openai", "azure", "vertex", "gemini"]) {
        registerHarnessProfile(`${provider}:*`, {
            systemPromptSuffix: FRONTIER_SUFFIX,
            maxTaskConcurrency: 4,
            parallelToolCalls: true,
            subagentPromptSuffix:
                "Work in parallel where you can, and stop as soon as more tool calls are unlikely to change your answer.",
        });
    }

    // Anthropic families.
    registerHarnessProfile("claude:claude-opus-*", { recursionLimit: 160, maxTaskConcurrency: 4 });
    registerHarnessProfile("claude:claude-sonnet-*", { recursionLimit: 120, maxTaskConcurrency: 4 });
    registerHarnessProfile("claude:claude-haiku-*", {
        recursionLimit: 64,
        maxTaskConcurrency: 2,
        maxExposedTools: 24,
    });

    // OpenAI / Azure families.
    registerHarnessProfile("openai:gpt-5*", { recursionLimit: 140, maxTaskConcurrency: 4 });
    registerHarnessProfile("openai:gpt-4o*", { recursionLimit: 100, maxTaskConcurrency: 3 });
    registerHarnessProfile("azure:gpt-5*", { recursionLimit: 140, maxTaskConcurrency: 4 });
    registerHarnessProfile("azure:gpt-4o*", { recursionLimit: 100, maxTaskConcurrency: 3 });

    // Google families.
    registerHarnessProfile("vertex:gemini-2*", { recursionLimit: 120, maxTaskConcurrency: 3 });
    registerHarnessProfile("gemini:gemini-2*", { recursionLimit: 120, maxTaskConcurrency: 3 });
    // Flash variants are the cheap tier — narrower budgets.
    registerHarnessProfile("gemini:gemini-2-flash*", { recursionLimit: 64, maxTaskConcurrency: 2 });
}
