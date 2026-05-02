import type { ReactNode } from "react";
import { Button } from "@kletron/ui/components/design-system";

export function SettingsCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`glass-card divide-y divide-border-subtle rounded-md overflow-hidden ${className}`}>{children}</div>
  );
}

/** Explains that local-only settings are not synced; links to a portal path under `/app/...`. */
export function DeviceOnlyPortalBanner({
  portalPath,
  onOpenPortal,
}: {
  portalPath: string;
  onOpenPortal: (path: string) => void;
}) {
  return (
    <div className="rounded-md border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <p className="text-xs text-text-secondary">
        <span className="font-medium text-text-primary">This device only.</span> These values are not synced to your Kletron
        workspace. Manage workspace defaults in the web portal.
      </p>
      <Button size="xs" variant="secondary" className="shrink-0 self-start sm:self-auto" onClick={() => onOpenPortal(portalPath)}>
        Open in browser
      </Button>
    </div>
  );
}
