import { Skeleton } from "@kletron/ui/components/design-system";

/** Portal embeddings/context snapshot lines while fetching workspace config */
export function DesktopPortalStatusLinesSkeleton() {
  return (
    <div
      className="space-y-1.5 pt-0.5"
      role="status"
      aria-busy="true"
      aria-label="Loading configuration status"
    >
      <Skeleton className="max-w-md" height="h-3" radius="rounded-md" />
      <Skeleton className="w-2/3 max-w-sm" height="h-3" radius="rounded-md" />
    </div>
  );
}

/** Agent graphs page — cards matching AgentGraphCard density */
export function DesktopAgentGraphCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid gap-3 max-w-3xl"
      role="status"
      aria-busy="true"
      aria-label="Loading graphs"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border-subtle bg-bg-surface/40 px-4 py-3 space-y-3"
        >
          <Skeleton className="h-4 w-[55%] max-w-xs" height="h-4" radius="rounded-md" />
          <Skeleton className="h-3 w-full max-w-xl" height="h-3" radius="rounded" />
          <Skeleton className="h-3 w-4/5 max-w-lg" height="h-3" radius="rounded" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-7 w-24" height="h-7" radius="rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Settings → graphs — rows with icon + title + meta (matches filled graph rows) */
export function DesktopSettingsGraphRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading graphs">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-md glass-card px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Skeleton className="h-4 w-4 shrink-0 rounded" height="h-4" />
              <Skeleton className="h-4 flex-1 max-w-[220px]" height="h-4" radius="rounded-md" />
            </div>
            <Skeleton className="h-3 w-10 shrink-0" height="h-3" radius="rounded" />
          </div>
          <Skeleton className="h-3 w-[88%] ml-6 max-w-xl" height="h-3" radius="rounded" />
          <Skeleton className="h-2.5 w-28 ml-6" height="h-2.5" radius="rounded" />
        </div>
      ))}
    </div>
  );
}

/** History runs + graph recent runs — bordered rows */
export function DesktopListRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="space-y-2 max-w-3xl" role="status" aria-busy="true" aria-label="Loading items">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-bg-surface/50 px-3 py-2"
        >
          <Skeleton className="h-3.5 flex-1 min-w-[120px] max-w-[280px]" height="h-3.5" radius="rounded-md" />
          <Skeleton className="h-3 w-14 shrink-0" height="h-3" radius="rounded" />
          <Skeleton className="h-7 w-24 shrink-0" height="h-7" radius="rounded-md" />
        </li>
      ))}
    </ul>
  );
}

/** Automations full-page detail pane — initial fetch */
export function DesktopAutomationDetailSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col items-stretch gap-4 p-8 max-w-lg mx-auto w-full"
      role="status"
      aria-busy="true"
      aria-label="Loading automations"
    >
      <Skeleton className="h-7 w-56" height="h-7" radius="rounded-md" />
      <Skeleton className="h-4 w-full" height="h-4" radius="rounded-md" />
      <Skeleton className="h-4 w-[92%]" height="h-4" radius="rounded-md" />
      <Skeleton className="h-4 w-4/5" height="h-4" radius="rounded-md" />
      <div className="flex gap-2 pt-6">
        <Skeleton className="h-9 w-28" height="h-9" radius="rounded-md" />
        <Skeleton className="h-9 w-28" height="h-9" radius="rounded-md" />
      </div>
    </div>
  );
}
