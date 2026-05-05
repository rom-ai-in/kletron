import { LayoutGrid, Zap } from "lucide-react";
import type { ActiveView } from "../types";

/** Only Agent + Automations — Settings / Account live under the thread sidebar Settings control. */
export type DesktopPrimaryNavId = "app" | "automations";

type Item = { id: DesktopPrimaryNavId; label: string; icon: typeof LayoutGrid };

const ITEMS: Item[] = [
  { id: "app", label: "Agent", icon: LayoutGrid },
  { id: "automations", label: "Automations", icon: Zap },
];

type Props = {
  activeView: ActiveView;
  onSelect: (view: DesktopPrimaryNavId) => void;
};

export function DesktopPrimaryNav({ activeView, onSelect }: Props) {
  return (
    <nav
      className="flex shrink-0 items-center gap-1 border-b border-border-subtle bg-bg-surface/80 px-3 py-1.5"
      aria-label="Primary navigation"
    >
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const current = activeView === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={current ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
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
