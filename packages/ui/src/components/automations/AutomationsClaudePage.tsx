'use client';

/**
 * Claude-style "Automation" page — the routines surface shared by web
 * (`/app/automations`) and desktop (`activeView === "automations"`).
 *
 * Purely presentational: a centred single-column list with a page header, a
 * search field, and one row per automation (icon tile, name, trigger summary,
 * enable switch, overflow actions). Data fetching stays with the caller so the
 * two shells can keep their own transports.
 */

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  GitBranch,
  Hand,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Timer,
  Webhook,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Switch } from '../ui/Toggle';
import { Skeleton } from '../ui/Skeleton';

export type AutomationsClaudeTrigger = 'manual' | 'schedule' | 'webhook' | 'git_event';

export interface AutomationsClaudeItem {
  id: string;
  name: string;
  description?: string;
  triggerType?: AutomationsClaudeTrigger;
  /** Human-readable trigger summary, e.g. "Every day at 09:00 · Europe/Zurich". */
  triggerLabel?: string;
  /** Controls the row switch. Omit to hide the switch for that row. */
  enabled?: boolean;
  lastRunAt?: string | Date | null;
  nextRunAt?: string | Date | null;
  /** Config incomplete (e.g. a stage without a prompt) — shows a warning dot. */
  needsAttention?: boolean;
}

export interface AutomationsClaudePageProps {
  items: AutomationsClaudeItem[];
  loading?: boolean;
  error?: string | null;
  /** Highlights the active row (desktop master/detail). */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onCreate?: () => void;
  onRun?: (id: string) => void;
  /** Omit to render rows without a switch. */
  onToggleEnabled?: (id: string, next: boolean) => void;
  /** Overflow (…) action per row. */
  onMore?: (id: string) => void;
  onRetry?: () => void;
  /** Shown under the title when a workspace is scoped. */
  workspaceName?: string;
  title?: string;
  subtitle?: string;
  createLabel?: string;
  className?: string;
}

const TRIGGER_ICONS: Record<AutomationsClaudeTrigger, LucideIcon> = {
  manual: Hand,
  schedule: Timer,
  webhook: Webhook,
  git_event: GitBranch,
};

const TRIGGER_LABELS: Record<AutomationsClaudeTrigger, string> = {
  manual: 'Manual',
  schedule: 'Scheduled',
  webhook: 'Webhook',
  git_event: 'Git event',
};

function formatWhen(value?: string | Date | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AutomationsClaudePage({
  items,
  loading = false,
  error = null,
  selectedId = null,
  onSelect,
  onCreate,
  onRun,
  onToggleEnabled,
  onMore,
  onRetry,
  workspaceName,
  title = 'Automation',
  subtitle = 'Agents that run on a schedule, a webhook, a git event — or on demand.',
  createLabel = 'New automation',
  className = '',
}: AutomationsClaudePageProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q),
    );
  }, [items, query]);

  const showSearch = items.length > 0 || query.length > 0;

  return (
    <div className={cn('h-full w-full overflow-y-auto scrollbar-elegant', className)}>
      <div className="mx-auto w-full max-w-[46rem] px-6 pb-16 pt-10 sm:px-8">
        {/* ── Header ── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-text-primary">
              {title}
            </h1>
            <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-text-muted">
              {subtitle}
            </p>
            {workspaceName ? (
              <p className="mt-2 text-[11px] text-text-muted">
                Workspace <span className="text-text-secondary">{workspaceName}</span>
              </p>
            ) : null}
          </div>

          {onCreate ? (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.07] px-3.5 py-2 text-[13px] font-medium text-text-primary transition-colors hover:bg-white/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {createLabel}
            </button>
          ) : null}
        </header>

        {/* ── Search ── */}
        {showSearch ? (
          <div className="relative mt-7">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search automations"
              aria-label="Search automations"
              className="w-full rounded-xl border border-white/[0.06] bg-black/[0.18] py-2.5 pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>
        ) : null}

        {/* ── Error ── */}
        {error ? (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-status-error-border bg-status-error-bg px-4 py-3 text-[13px] text-status-error-text">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="leading-snug">{error}</p>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-1.5 text-[12px] font-medium underline underline-offset-2"
                >
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ── List ── */}
        <div className="mt-6">
          {loading && items.length === 0 ? (
            <ul className="flex flex-col" aria-busy="true" aria-label="Loading automations">
              {Array.from({ length: 5 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 border-b border-white/[0.05] px-2 py-3.5 last:border-b-0"
                >
                  <Skeleton width="w-8" height="h-8" radius="rounded-lg" className="shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton width="w-[42%]" height="h-3.5" radius="rounded" />
                    <Skeleton width="w-[68%]" height="h-2.5" radius="rounded" />
                  </div>
                  <Skeleton width="w-9" height="h-5" radius="rounded-full" className="shrink-0" />
                </li>
              ))}
            </ul>
          ) : filtered.length === 0 ? (
            <EmptyAutomations
              searching={query.trim().length > 0}
              onCreate={onCreate}
              createLabel={createLabel}
            />
          ) : (
            <ul className="flex flex-col">
              {filtered.map((item) => (
                <AutomationRow
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  onSelect={onSelect}
                  onRun={onRun}
                  onToggleEnabled={onToggleEnabled}
                  onMore={onMore}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AutomationRow({
  item,
  selected,
  onSelect,
  onRun,
  onToggleEnabled,
  onMore,
}: {
  item: AutomationsClaudeItem;
  selected: boolean;
  onSelect?: (id: string) => void;
  onRun?: (id: string) => void;
  onToggleEnabled?: (id: string, next: boolean) => void;
  onMore?: (id: string) => void;
}) {
  const trigger = item.triggerType ?? 'manual';
  const TriggerIcon = TRIGGER_ICONS[trigger];
  const nextRun = formatWhen(item.nextRunAt);
  const lastRun = formatWhen(item.lastRunAt);

  const meta =
    item.triggerLabel ??
    [TRIGGER_LABELS[trigger], nextRun ? `next ${nextRun}` : lastRun ? `last run ${lastRun}` : null]
      .filter(Boolean)
      .join(' · ');

  return (
    <li className="border-b border-white/[0.05] last:border-b-0">
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg px-2 py-3 transition-colors',
          selected ? 'bg-state-selected' : 'hover:bg-state-hover',
        )}
      >
        <button
          type="button"
          onClick={() => onSelect?.(item.id)}
          disabled={!onSelect}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0 disabled:cursor-default"
        >
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-text-muted transition-colors',
              !selected && 'group-hover:text-text-secondary',
            )}
            aria-hidden
          >
            <Zap className="h-[15px] w-[15px]" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13.5px] font-medium text-text-primary">
                {item.name}
              </span>
              {item.needsAttention ? (
                <AlertCircle
                  className="h-3.5 w-3.5 shrink-0 text-status-warning-text"
                  aria-label="Configuration incomplete"
                />
              ) : null}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-text-muted">
              <TriggerIcon className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{meta}</span>
            </span>
            {item.description ? (
              <span className="mt-0.5 block truncate text-[11.5px] text-text-muted/80">
                {item.description}
              </span>
            ) : null}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {onRun ? (
            <button
              type="button"
              onClick={() => onRun(item.id)}
              title="Run now"
              aria-label={`Run ${item.name} now`}
              className="rounded-md p-1.5 text-text-muted opacity-0 transition-all hover:bg-white/[0.07] hover:text-text-primary focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Play className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}

          {onToggleEnabled && item.enabled !== undefined ? (
            <Switch
              size="sm"
              checked={item.enabled}
              onChange={(next) => onToggleEnabled(item.id, next)}
              aria-label={`${item.enabled ? 'Disable' : 'Enable'} ${item.name}`}
            />
          ) : null}

          {onMore ? (
            <button
              type="button"
              onClick={() => onMore(item.id)}
              title="More actions"
              aria-label={`More actions for ${item.name}`}
              className="rounded-md p-1.5 text-text-muted opacity-0 transition-all hover:bg-white/[0.07] hover:text-text-primary focus-visible:opacity-100 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function EmptyAutomations({
  searching,
  onCreate,
  createLabel,
}: {
  searching: boolean;
  onCreate?: () => void;
  createLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.07] px-6 py-14 text-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-text-muted"
        aria-hidden
      >
        {searching ? <Search className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
      </span>
      <h2 className="mt-4 text-[15px] font-medium text-text-primary">
        {searching ? 'No automation matches your search' : 'No automation yet'}
      </h2>
      <p className="mt-1.5 max-w-[38ch] text-[12.5px] leading-relaxed text-text-muted">
        {searching
          ? 'Try a different name or clear the search field.'
          : 'Create one to run an agent on a schedule, from a webhook, or on a git event.'}
      </p>
      {!searching && onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.07] px-3.5 py-2 text-[13px] font-medium text-text-primary transition-colors hover:bg-white/[0.11]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {createLabel}
        </button>
      ) : null}
    </div>
  );
}
