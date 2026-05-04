import { useMemo } from "react";
import { WORK_MODES, normalizeToWorkModeId } from "@kletron/shared/workMode";

interface CategoryRoutingResult {
  activeCategory: string;
  availableTools: string[];
  systemPrompt: string;
}

export function useCategoryRouting(activeCategoryId: string): CategoryRoutingResult {
  return useMemo(() => {
    const mode = normalizeToWorkModeId(activeCategoryId || "code");
    const w = WORK_MODES[mode];
    return {
      activeCategory: mode,
      availableTools: w.availableTools,
      systemPrompt: w.defaultPrompt,
    };
  }, [activeCategoryId]);
}
