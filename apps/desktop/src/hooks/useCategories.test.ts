// Simple test for useCategories hook (vitest)
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCategories, BUILT_IN_CATEGORIES } from "./useCategories";

describe("useCategories", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should initialize with code as default category", () => {
    const { result } = renderHook(() => useCategories());
    expect(result.current.activeCategory).toBe("code");
  });

  it("should return all built-in categories", () => {
    const { result } = renderHook(() => useCategories());
    expect(result.current.allCategories.slice(0, 2)).toEqual(BUILT_IN_CATEGORIES);
  });

  it("should allow changing active category to work", () => {
    const { result } = renderHook(() => useCategories());

    act(() => {
      result.current.setActiveCategory("work");
    });

    expect(result.current.activeCategory).toBe("work");
  });

  it("should persist active category in localStorage", () => {
    const { result } = renderHook(() => useCategories());

    act(() => {
      result.current.setActiveCategory("work");
    });

    expect(localStorage.getItem("kletron-active-category")).toBe("work");
  });

  it("should load saved category from localStorage", () => {
    localStorage.setItem("kletron-active-category", "work");

    const { result } = renderHook(() => useCategories());
    expect(result.current.activeCategory).toBe("work");
  });

  it("should map legacy general id to work", () => {
    localStorage.setItem("kletron-active-category", "general");

    const { result } = renderHook(() => useCategories());
    expect(result.current.activeCategory).toBe("work");
  });
});
