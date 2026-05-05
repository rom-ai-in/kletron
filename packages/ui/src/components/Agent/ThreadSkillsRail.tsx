"use client";

import type { ReactNode } from "react";
import { Zap } from "lucide-react";
import type { ThreadSkillState } from "@kletron/shared/skills/types";
import { SkillPill } from "./ContextChips";

export type ThreadSkillsRailProps = {
  skills: ThreadSkillState | null | undefined;
  /** `inline` — natural height (parent provides scroll). */
  layout: "fill" | "compact" | "inline";
  /** e.g. Next.js `<Link>` or a desktop button that opens the portal */
  openSkillsControl?: ReactNode;
};

export function ThreadSkillsRail({ skills, layout, openSkillsControl }: ThreadSkillsRailProps) {
  const available = skills?.availableSkills ?? [];
  const loaded = skills?.loadedSkills ?? [];
  const pinned = skills?.pinnedSkills ?? [];

  const Section = ({
    title,
    count,
    children,
  }: {
    title: string;
    count: number;
    children: ReactNode;
  }) => (
    <section className="border-b border-white/[0.05] px-2.5 py-2 last:border-b-0">
      <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
        {title} ({count})
      </h3>
      {children}
    </section>
  );

  const renderPills = (labels: string[]) =>
    labels.length === 0 ? (
      <span className="text-[10px] text-text-muted">None</span>
    ) : (
      <div className="flex flex-col gap-1">
        {labels.map((item) => (
          <SkillPill key={item} label={item} className="w-max max-w-full" />
        ))}
      </div>
    );

  const scrollClass =
    layout === "compact"
      ? "max-h-[min(36vh,260px)] shrink-0 overflow-y-auto scrollbar-elegant"
      : layout === "inline"
        ? "overflow-visible"
        : "min-h-0 flex-1 overflow-y-auto scrollbar-elegant";

  const openDefault = (
    <a href="/app/skills" className="ml-auto text-[10px] font-medium text-status-info-text hover:underline">
      Open
    </a>
  );

  return (
    <div
      className={
        layout === "compact"
          ? "flex min-h-0 shrink-0 flex-col overflow-hidden border-b border-white/[0.06] bg-bg-surface"
          : layout === "inline"
            ? "flex shrink-0 flex-col overflow-visible border-b border-white/[0.06] bg-bg-surface"
            : "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-bg-surface"
      }
    >
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.06] px-2.5 py-1.5">
        <Zap className="h-3 w-3 shrink-0 text-status-info-text" aria-hidden />
        <span className="text-[11px] font-semibold text-text-primary">Skills</span>
        {openSkillsControl ?? openDefault}
      </div>
      <div className={scrollClass}>
        <Section title="Workspace" count={available.length}>
          {renderPills(
            available.map((skill) =>
              skill.autoLoadInNewThreads ? `${skill.name} · auto-load` : skill.name,
            ),
          )}
        </Section>
        <Section title="This thread" count={loaded.length}>
          {renderPills(
            loaded.map((skill) => (skill.reason ? `${skill.name} · ${skill.reason}` : skill.name)),
          )}
        </Section>
        <Section title="Pinned by graph" count={pinned.length}>
          {renderPills(pinned.map((skill) => skill.name))}
        </Section>
      </div>
    </div>
  );
}
