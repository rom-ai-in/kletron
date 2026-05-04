"use client";

import { ContextConfigView } from "@kletron/ui/components/config/ContextConfigView";

/** Fills the main scroll region below AppHeader (h-14) so tab panes can use flex + overflow correctly. */
export default function ConfigContextPage() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[28rem] w-full min-w-0 flex-col overflow-hidden">
      <ContextConfigView />
    </div>
  );
}
