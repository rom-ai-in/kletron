export const TAB_CONFIG = [
    { id: "foundation", label: "Foundation" },
    { id: "components", label: "Components" },
    { id: "patterns", label: "Patterns" },
    { id: "portal", label: "Portal" },
    { id: "mac-app", label: "Mac App" },
    { id: "agent", label: "Agent" },
] as const;

export type TabId = (typeof TAB_CONFIG)[number]["id"];
export type TabLabel = (typeof TAB_CONFIG)[number]["label"];

export const TAB_ID_SET = new Set<TabId>(TAB_CONFIG.map((tab) => tab.id));
