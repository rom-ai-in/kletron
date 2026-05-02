// CategorySwitcher.tsx - Inline mode switcher (Code vs Work)
"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@kletron/ui/components/ui/tabs";
import { normalizeToWorkModeId } from "@kletron/shared/workMode";

interface CategorySwitcherProps {
  workspaceId: string;
}

export function CategorySwitcher({ workspaceId }: CategorySwitcherProps) {
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
      value={activeTab}
      onValueChange={(value) => {
        setActiveTab(value);
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set("category", value);
        router.push(`${pathname}?${params.toString()}`, undefined);
      }}
    >
      <TabsList className="grid grid-cols-2 gap-1 bg-transparent p-0">
        {categories.map((category) => (
          <TabsTrigger
            key={category.id}
            value={category.id}
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary h-8 px-2 py-1 text-xs"
            style={{ borderColor: category.color }}
          >
            <span className="flex items-center gap-1">{category.name}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
