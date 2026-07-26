/**
 * Per-model tuning applied on top of a graph's own prompt and budgets.
 *
 * The same graph should behave sensibly on Claude Opus and on a 7B model running
 * in LM Studio. Those two need very different harnesses — parallel tool calls and
 * subagent fan-out on one, one-tool-per-turn and a short tool list on the other.
 * Rather than fork the graphs, the graph stays model-agnostic and the profile
 * carries the model-specific part.
 */
export type HarnessProfile = {
    /** Appended to the end of the system prompt, after everything else. */
    systemPromptSuffix?: string;
    /** Appended to a subagent's system prompt instead of `systemPromptSuffix`. */
    subagentPromptSuffix?: string;
    /** Default LangGraph recursion limit (tool/LLM steps) for this model. */
    recursionLimit?: number;
    /** Max concurrent subagents. `0` hides the `task` tool entirely. */
    maxTaskConcurrency?: number;
    /** Chars a tool result may reach before it is evicted to disk. */
    toolResultCharBudget?: number;
    /** Cap on how many tools are exposed at once (small models degrade past ~20). */
    maxExposedTools?: number;
    /** Whether the model reliably emits several independent tool calls per turn. */
    parallelToolCalls?: boolean;
};

/** A profile keyed for the registry, e.g. `claude:claude-opus-*`. */
export type HarnessProfileEntry = {
    key: string;
    profile: HarnessProfile;
};
