/** Buckets for grouping sidebar threads by calendar recency (local timezone). */
export type ThreadRecencyBucket =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "older"
  | "missing";

/** Non-archived sections only; UI adds Archived separately. */
export const THREAD_RECENCY_SECTION_ORDER: ThreadRecencyBucket[] = [
  "today",
  "yesterday",
  "last7",
  "last30",
  "older",
  "missing",
];

export const THREAD_RECENCY_LABELS: Record<ThreadRecencyBucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  older: "Older",
  missing: "Undated",
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whole calendar days from `earlier` start-of-day to `later` start-of-day (non-negative). */
export function calendarDaysFromEarlierToLater(earlier: Date, later: Date): number {
  const ms = startOfLocalDay(later).getTime() - startOfLocalDay(earlier).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Classify an activity timestamp into a sidebar bucket relative to `now`.
 * Future timestamps are treated as `today`.
 */
export function threadRecencyBucket(
  iso: string | undefined | null,
  now: Date = new Date(),
): ThreadRecencyBucket {
  if (iso == null || iso === "") return "missing";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "missing";

  const ref = t.getTime() > now.getTime() ? now : t;
  const daysAgo = calendarDaysFromEarlierToLater(ref, now);

  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo >= 2 && daysAgo <= 6) return "last7";
  if (daysAgo >= 7 && daysAgo <= 29) return "last30";
  return "older";
}

/** Parse ISO for sorting; invalid → null (sort last when combined with bucket order). */
export function parseThreadRecencyMs(iso: string | undefined | null): number | null {
  if (iso == null || iso === "") return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return t.getTime();
}
