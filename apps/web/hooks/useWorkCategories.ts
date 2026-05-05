// apps/web/hooks/useWorkCategories.ts
"use client";

import { useState, useEffect } from "react";
import type { WorkCategoryConfig } from "@kletron/shared";

export function useWorkCategories() {
  const [categories, setCategories] = useState<WorkCategoryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch("/api/work-categories");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: WorkCategoryConfig[] = await response.json();
        setCategories(data);
      } catch (err) {
        console.error("Failed to fetch work categories:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchCategories();
  }, []);

  return { categories, loading, error };
}
