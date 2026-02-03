"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { Breadcrumbs } from "@/src/components/ui/Breadcrumbs";

export function AppHeader() {
  const [runningCount, setRunningCount] = useState(0);

  useEffect(() => {
    const fetchRunningCount = async () => {
      try {
        const res = await fetch("/api/runs?limit=100");
        if (res.ok) {
          const data = await res.json();
          const running = data.runs?.filter((r: any) => r.status === "RUNNING").length || 0;
          setRunningCount(running);
        }
      } catch (e) {
        console.error("Failed to fetch running count", e);
      }
    };

    void fetchRunningCount();
    const interval = setInterval(() => void fetchRunningCount(), 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-border-subtle bg-bg-surface">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        <Breadcrumbs />

        <Link
          href="/app/history"
          className="relative flex items-center justify-center rounded-md p-2 text-text-secondary hover:bg-state-hover hover:text-text-primary transition-colors"
          title="Activity"
        >
          <History className="h-4 w-4" />
          {runningCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white border-2 border-bg-surface animate-pulse">
              {runningCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

