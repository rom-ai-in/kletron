// CategorySwitcher.tsx - Inline mode switcher (Code vs Work)
"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabTrigger } from "@kletron/ui/components/ui/Tabs";
import { normalizeToWorkModeId } from "@kletron/shared/workMode";

interface CategorySwitcherProps {
  workspaceId: string;
}

export function CategorySwitcher({ workspaceId: _workspaceId }: CategorySwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const categories = [
    { id: "code", name: "Code", color: "#3b82f6" },
    { id: "work", name: "Work", color: "#6366f1" },
  ];

  const activeCategory = normalizeToWorkModeId(searchParams?.get("category") || "code");
  const [activeTab, setActiveTab] = useState(activeCategory);

  return (
    <Tabs
      defaultValue={activeCategory}
      value={activeTab}
      onValueChange={(value) => {
        const mode = normalizeToWorkModeId(value);
        setActiveTab(mode);
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set("category", mode);
        router.push(`${pathname}?${params.toString()}`, undefined);
      }}
    >
      <TabsList className="grid grid-cols-2 gap-1 bg-transparent p-0">
        {categories.map((category) => (
          <TabTrigger
            key={category.id}
            value={category.id}
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary h-8 px-2 py-1 text-xs"
            style={{ borderColor: category.color }}
          >
            <span className="flex items-center gap-1">{category.name}</span>
          </TabTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
