/**
 * Agent research depth: exhaustive (default) vs faster, fewer-tool runs.
 * Stored on agent graph runs; drives system-prompt suffix and LangGraph recursion budget.
 */

export type ResearchDepthId = "exhaustive" | "fast";

export function normalizeResearchDepth(raw: unknown): ResearchDepthId {
    if (raw === "fast" || raw === "exhaustive") return raw;
    const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (s === "fast" || s === "quick" || s === "speed") return "fast";
    return "exhaustive";
}

/** Appended to the composed system prompt when {@link ResearchDepthId} is `fast`. */
export const RESEARCH_DEPTH_FAST_SYSTEM_SUFFIX = `

## SPEED MODE (ACTIVE)

- Prefer a **small** number of well-chosen tool calls; one targeted search plus direct reads is enough when the question is narrow.
- Stop tooling once the user’s question is answered with reasonable confidence.
- Keep the final reply **shorter** unless the user asked for a long report.
`;
