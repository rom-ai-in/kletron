import { ArrowLeft, ExternalLink, Play, MessageSquare } from "lucide-react";
import { Button } from "@kletron/ui/components/design-system";
import type { Automation } from "@kletron/ui/components/CommandCenter/AutomationsDashboard";
import { DesktopAutomationDetailSkeleton } from "../components/DesktopLoadingSkeletons";

function formatRelative(iso?: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Props = {
  automation: Automation | null;
  loading?: boolean;
  /** True when list loaded but nothing selected */
  emptySelection?: boolean;
  /** True when API returned zero automations */
  listEmpty?: boolean;
  onRunNow: () => void | Promise<void>;
  onOpenInBrowser: () => void;
  onOpenThread?: () => void;
  /** Returns to the automations list (no master rail in the Claude layout). */
  onBack?: () => void;
  runBusy?: boolean;
};

export function DesktopAutomationDetailShell({
  automation,
  loading = false,
  emptySelection = false,
  listEmpty = false,
  onRunNow,
  onOpenInBrowser,
  onOpenThread,
  onBack,
  runBusy = false,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-1 min-h-0 flex-col">
        <DesktopAutomationDetailSkeleton />
      </div>
    );
  }

  if (listEmpty && !loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium text-text-primary">No automations yet</p>
        <p className="text-xs text-text-muted max-w-sm">
          Create one from the sidebar (+) or open the web app for advanced setup.
        </p>
      </div>
    );
  }

  if (!automation && emptySelection) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium text-text-primary">Select an automation</p>
        <p className="text-xs text-text-muted max-w-sm">
          Choose one from the list or create a new automation. Edit triggers and stages in the web app.
        </p>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-text-muted">
        <span className="text-sm">No automation selected</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 flex-col overflow-y-auto scrollbar-elegant bg-bg-surface">
      <div className="border-b border-border-subtle px-6 py-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 mb-2 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-text-muted transition-colors hover:bg-state-hover hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Automation
          </button>
        ) : null}
        <h2 className="text-lg font-semibold text-text-primary truncate">{automation.name}</h2>
        {automation.description ? (
          <p className="mt-1 text-sm text-text-secondary">{automation.description}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted">
          <span>
            Status: <span className="text-text-primary capitalize">{automation.status}</span>
          </span>
          {automation.schedule ? (
            <span>
              Schedule: <span className="font-mono text-text-primary">{automation.schedule}</span>
            </span>
          ) : null}
          <span>Last run: {formatRelative(automation.lastRunAt)}</span>
          {automation.nextRunAt ? <span>Next: {formatRelative(automation.nextRunAt)}</span> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-6 py-4">
        <Button size="sm" variant="secondary" onClick={() => void onRunNow()} disabled={runBusy} type="button">
          <Play className="h-3.5 w-3.5 mr-1" />
          {runBusy ? "Starting…" : "Run now"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenInBrowser} type="button">
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          Open in browser
        </Button>
        {automation.lastSessionId ? (
          <Button size="sm" variant="ghost" onClick={onOpenThread} type="button">
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Open thread
          </Button>
        ) : null}
      </div>
      <div className="px-6 pb-6">
        <p className="text-xs text-text-muted">
          Full editor (triggers, stages, history) lives in the web app — use &quot;Open in browser&quot; to manage this
          automation.
        </p>
      </div>
    </div>
  );
}
