"use client";

import React from "react";
import { Folder } from "lucide-react";
import { WORK_MODES, type WorkModeId } from "@kletron/shared/workMode";
import { WorkModeSegmented } from "./WorkModeSegmented";
import { ThreadSearchHeaderTrigger } from "./ThreadSearchHeaderTrigger";

export type AgentSessionChromeProps = {
  workMode: WorkModeId;
  onWorkModeChange: (mode: WorkModeId) => void;
  /**
   * When false, the Code/Work control is not shown here (e.g. it lives in the thread sidebar).
   * Keep passing workMode for tinting and code-only rows.
   */
  showWorkModeSwitcher?: boolean;
  /** Main workspace line: name + path, or error, or empty state — or pass simple strings below */
  workspaceSlot?: React.ReactNode;
  /** When `workspaceSlot` is omitted, show name + path */
  workspaceName?: string | null;
  workspaceRootPath?: string | null;
  /** Optional error/retry UI when workspace failed to load (web) */
  workspaceErrorSlot?: React.ReactNode;
  /** Trailing controls on row 1 (e.g. web Tools / Graph / metrics) */
  trailing?: React.ReactNode;
  /** Second row for Code mode only (e.g. repo strip). Omitted when empty to keep chrome a single row. */
  codeModeSecondRow?: React.ReactNode;
  /** Workspace thread quick search (web agent header). */
  onOpenThreadSearch?: () => void;
  threadSearchPlaceholder?: string;
  threadSearchDisabled?: boolean;
  /**
   * Omit row 1 (mode switcher + workspace + thread search + trailing) — e.g. desktop when
   * workspace context lives in the title bar and only the code strip should show.
   */
  suppressFirstRow?: boolean;
  className?: string;
};

/**
 * Tinted session chrome: Code/Work + workspace context + optional repo strip (matches web agent layout).
 */
export function AgentSessionChrome({
  workMode,
  onWorkModeChange,
  showWorkModeSwitcher = true,
  workspaceSlot,
  workspaceName,
  workspaceRootPath,
  workspaceErrorSlot,
  trailing,
  codeModeSecondRow,
  onOpenThreadSearch,
  threadSearchPlaceholder = "",
  threadSearchDisabled = false,
  suppressFirstRow = false,
  className = "",
}: AgentSessionChromeProps) {
  const modeChromeColor = WORK_MODES[workMode].color;

  const workspaceMain =
    workspaceSlot ??
    (workspaceErrorSlot ? (
      workspaceErrorSlot
    ) : workspaceName ? (
      <div className="flex items-center gap-2 min-w-0">
        <Folder className="h-3.5 w-3.5 text-text-muted flex-shrink-0" aria-hidden />
        <span className="text-[11px] font-medium text-text-secondary truncate">{workspaceName}</span>
        {workspaceRootPath ? (
          <span className="text-[10px] text-text-muted truncate hidden sm:inline max-w-[min(280px,40vw)]">
            {workspaceRootPath}
          </span>
        ) : null}
      </div>
    ) : (
      <div className="text-[11px] text-text-muted">No workspace selected</div>
    ));

  const hasSecondRow = workMode === "code" && Boolean(codeModeSecondRow);
  const hasFirstRow = !suppressFirstRow;

  if (!hasFirstRow && !hasSecondRow) return null;

  return (
    <section
      aria-label={
        showWorkModeSwitcher
          ? "Agent session"
          : `Agent session, ${WORK_MODES[workMode].name} mode. Change mode in the thread sidebar.`
      }
      aria-details={showWorkModeSwitcher ? undefined : "sidebar-work-mode-desc"}
      className={`flex-none flex flex-col gap-1 border-b px-4 py-1.5 app-region-no-drag ${className}`}
      style={{
        backgroundColor: `${modeChromeColor}12`,
        borderBottomColor: `${modeChromeColor}35`,
      }}
    >
      {hasFirstRow ? (
        <div className="flex min-h-0 flex-nowrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {showWorkModeSwitcher ? (
              <WorkModeSegmented value={workMode} onChange={onWorkModeChange} />
            ) : null}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="min-w-0 flex-1">{workspaceMain}</div>
              {onOpenThreadSearch ? (
                <ThreadSearchHeaderTrigger
                  onClick={onOpenThreadSearch}
                  placeholder={threadSearchPlaceholder}
                  disabled={threadSearchDisabled}
                />
              ) : null}
            </div>
          </div>
          {trailing ? (
            <div className="flex min-w-0 shrink items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-elegant">
              {trailing}
            </div>
          ) : null}
        </div>
      ) : null}

      {hasSecondRow ? (
        <div className="flex flex-wrap items-center gap-2">{codeModeSecondRow}</div>
      ) : null}
    </section>
  );
}
