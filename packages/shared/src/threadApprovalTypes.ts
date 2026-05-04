/**
 * Per-thread (AgentGraphRun) approval mode. Stored on the run document;
 * overrides workspace defaults for interactive agent sessions only.
 */
export const THREAD_APPROVAL_MODES = [
    "inherit",
    "confirm_everything",
    "full_auto_thread",
] as const;

export type ThreadApprovalMode = (typeof THREAD_APPROVAL_MODES)[number];

const MODE_SET = new Set<string>(THREAD_APPROVAL_MODES);

/** Parse API/user input; invalid or missing → inherit. */
export function parseThreadApprovalMode(raw: unknown): ThreadApprovalMode {
    if (typeof raw !== "string") return "inherit";
    const n = raw.trim();
    return MODE_SET.has(n) ? (n as ThreadApprovalMode) : "inherit";
}
