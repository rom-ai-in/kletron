"use client";

import { Breadcrumbs } from "@/src/components/ui/Breadcrumbs";

export function AppHeader() {
  return (
    <header className="border-b border-border-subtle bg-bg-surface">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        <Breadcrumbs />
      </div>
    </header>
  );
}

