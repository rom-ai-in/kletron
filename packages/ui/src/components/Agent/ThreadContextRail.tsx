"use client";

import { FileText, FolderOpen, Layers, Search } from "lucide-react";
import type { ThreadContextFootprint } from "../../lib/threadContextFootprint";
import { isThreadContextFootprintEmpty } from "../../lib/threadContextFootprint";

export type ThreadContextRailProps = {
  footprint: ThreadContextFootprint;
  /** @see ThreadSkillsRail — `inline` = natural height inside a parent scroll area */
  layout: "fill" | "compact" | "inline";
};

function ItemList({ title, icon: Icon, items }: { title: string; icon: typeof FileText; items: string[] }) {
  if (items.length === 0) return null;
  const cap = 24;
  const shown = items.slice(0, cap);
  return (
    <section className="border-b border-white/[0.05] px-2.5 py-2 last:border-b-0">
      <h3 className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
        <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        {title} ({items.length})
      </h3>
      <ul className="max-w-full space-y-0.5">
        {shown.map((p) => (
          <li
            key={p}
            className="break-all font-mono text-[10px] leading-snug text-text-secondary"
            title={p}
          >
            {p}
          </li>
        ))}
        {items.length > cap ? (
          <li className="text-[10px] text-text-muted">+{items.length - cap} more</li>
        ) : null}
      </ul>
    </section>
  );
}

export function ThreadContextRail({ footprint, layout }: ThreadContextRailProps) {
  const scrollClass =
    layout === "compact"
      ? "max-h-[min(32vh,240px)] shrink-0 overflow-y-auto scrollbar-elegant"
      : layout === "inline"
        ? "overflow-visible"
        : "min-h-0 flex-1 overflow-y-auto scrollbar-elegant";

  const outerClass =
    layout === "compact"
      ? "flex min-h-0 shrink-0 flex-col overflow-hidden border-b border-white/[0.06] bg-bg-surface"
      : layout === "inline"
        ? "flex shrink-0 flex-col overflow-visible border-b border-white/[0.06] bg-bg-surface"
        : "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-bg-surface";

  const empty = isThreadContextFootprintEmpty(footprint);

  return (
    <div className={outerClass}>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.06] px-2.5 py-1.5">
        <Layers className="h-3 w-3 shrink-0 text-text-muted" aria-hidden />
        <span className="text-[11px] font-semibold text-text-primary">Context</span>
      </div>
      <div className={scrollClass}>
        {empty ? (
          <p className="px-2.5 py-3 text-[10px] leading-relaxed text-text-muted">
            File reads, searches, and other tool usage will show here as the agent builds context for this
            thread.
          </p>
        ) : (
          <>
            <section className="border-b border-white/[0.05] px-2.5 py-2">
              <div className="text-[10px] font-medium text-text-secondary">Tools</div>
              <p className="mt-0.5 font-mono text-[10px] leading-snug text-text-muted">{footprint.summaryLine}</p>
              {(footprint.bundleDynamicItems != null || footprint.bundleSnippets != null) && (
                <p className="mt-1 text-[10px] text-text-muted">
                  {footprint.bundleDynamicItems != null ? (
                    <span>Dynamic context: {footprint.bundleDynamicItems} items</span>
                  ) : null}
                  {footprint.bundleDynamicItems != null && footprint.bundleSnippets != null ? " · " : null}
                  {footprint.bundleSnippets != null ? (
                    <span>{footprint.bundleSnippets} snippets</span>
                  ) : null}
                </p>
              )}
            </section>
            <ItemList title="Files read" icon={FileText} items={footprint.filesRead} />
            <ItemList title="Searches" icon={Search} items={footprint.searchQueries} />
            <ItemList title="Files written" icon={FileText} items={footprint.filesWritten} />
            <ItemList title="Directories listed" icon={FolderOpen} items={footprint.dirsListed} />
            <ItemList title="Web / fetch" icon={Search} items={footprint.networkQueries} />
            <ItemList title="Context graph (memory)" icon={Layers} items={footprint.memoryGraphPaths} />
          </>
        )}
      </div>
    </div>
  );
}
