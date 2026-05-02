import { LayoutGrid, History, Zap, Network, Settings } from "lucide-react";
import type { ActiveView } from "../types";

type Item = { id: ActiveView; label: string; icon: typeof LayoutGrid };

const ITEMS: Item[] = [
  { id: "app", label: "Agent", icon: LayoutGrid },
  { id: "history", label: "History", icon: History },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "agent-graphs", label: "Graphs", icon: Network },
  { id: "settings", label: "Settings", icon: Settings },
];

type Props = {
  activeView: ActiveView;
  onSelect: (view: ActiveView) => void;
};

export function DesktopPrimaryNav({ activeView, onSelect }: Props) {
  return (
    <nav
      className="flex shrink-0 items-center gap-1 border-b border-border-subtle bg-bg-surface/80 px-3 py-1.5"
      aria-label="Primary navigation"
    >
      {ITEMS.map(({ id, label, icon: Icon }, index) => {
        const current = activeView === id;
        const isLast = index === ITEMS.length - 1;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={current ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              isLast ? "ml-auto " : ""
            }${
              current
                ? "bg-state-selected text-text-primary"
                : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
