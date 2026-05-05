// apps/web/hooks/useCurrentCategory.ts
"use client";

import { useLocalStorage } from "../hooks/useLocalStorage";

export function useCurrentCategory() {
  const [category, setCategory] = useLocalStorage<string>("kletron-current-category", "coding");

  return {
    currentCategory: category,
    setCategory
  };
}
