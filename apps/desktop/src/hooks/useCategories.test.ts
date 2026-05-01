// Simple test for useCategories hook
import { renderHook, act } from '@testing-library/react';
import { useCategories, BUILT_IN_CATEGORIES } from './useCategories';

describe('useCategories', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize with coding as default category', () => {
    const { result } = renderHook(() => useCategories());
    expect(result.current.activeCategory).toBe('coding');
  });

  it('should return all built-in categories', () => {
    const { result } = renderHook(() => useCategories());
    expect(result.current.categories).toEqual(BUILT_IN_CATEGORIES);
  });

  it('should allow changing active category', () => {
    const { result } = renderHook(() => useCategories());
    
    act(() => {
      result.current.setActiveCategory('general');
    });
    
    expect(result.current.activeCategory).toBe('general');
  });

  it('should persist active category in localStorage', () => {
    const { result } = renderHook(() => useCategories());
    
    act(() => {
      result.current.setActiveCategory('drafting');
    });
    
    expect(localStorage.getItem('kletron-active-category')).toBe('drafting');
  });

  it('should load saved category from localStorage', () => {
    localStorage.setItem('kletron-active-category', 'automation');
    
    const { result } = renderHook(() => useCategories());
    expect(result.current.activeCategory).toBe('automation');
  });

  it('should fall back to coding if saved category is invalid', () => {
    localStorage.setItem('kletron-active-category', 'invalid-category');
    
    const { result } = renderHook(() => useCategories());
    expect(result.current.activeCategory).toBe('coding');
  });
});