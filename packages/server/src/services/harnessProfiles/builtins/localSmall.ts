import { registerHarnessProfile } from "../registry";

/**
 * Harness for locally-hosted models (LM Studio / Ollama / vLLM).
 *
 * This is the profile that matters most for Kletron's local-first / BYOK
 * positioning. Small models fail in specific, predictable ways: they pick badly
 * from long tool lists, they lose the thread across many steps, they emit one
 * malformed call when asked for several, and they answer from memory rather than
 * reading. Every field below targets one of those.
 *
 * `maxTaskConcurrency: 0` is the important one — it removes the `task` tool
 * entirely. A 7B model cannot usefully orchestrate subagents, and exposing the
 * tool just gives it a way to burn tokens producing nothing.
 */
const LOCAL_SMALL_SUFFIX = `## Harness

- **One tool per turn.** Do not try to call several tools at once.
- After each tool result, state in one sentence what you learned before calling the next tool.
- **Never answer from memory.** Read at least one file before making any claim about this codebase.
- Prefer \`search_code\` to guessing a path. Prefer \`read_file_range\` to reading whole large files.
- When you have enough to answer, stop calling tools and answer.`;

export function register(): void {
    for (const provider of ["lmstudio", "ollama", "vllm"]) {
        registerHarnessProfile(`${provider}:*`, {
            systemPromptSuffix: LOCAL_SMALL_SUFFIX,
            subagentPromptSuffix: LOCAL_SMALL_SUFFIX,
            // No subagent orchestration on small local models.
            maxTaskConcurrency: 0,
            parallelToolCalls: false,
            maxExposedTools: 16,
            recursionLimit: 24,
            toolResultCharBudget: 6_000,
        });
    }
}
