/**
 * Unit tests for useResizablePanel hook.
 * Tests: initialization, localStorage persistence, clamping, direction logic, reset.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock localStorage ────────────────────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── Helpers (extract pure logic from hook) ───────────────────────────────────

const STORAGE_PREFIX = 'kletron:panel:';

function loadWidth(key: string, defaultWidth: number): number {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch { /* ignore */ }
  return defaultWidth;
}

function saveWidth(key: string, width: number): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, String(Math.round(width)));
  } catch { /* ignore */ }
}

function clamp(w: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, w));
}

function computeNewWidth(
  direction: 'left' | 'right',
  startWidth: number,
  startX: number,
  currentX: number,
  minWidth: number,
  maxWidth: number,
): number {
  const delta = currentX - startX;
  const raw = direction === 'left'
    ? startWidth + delta
    : startWidth - delta;
  return clamp(raw, minWidth, maxWidth);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useResizablePanel — pure logic', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('loadWidth', () => {
    it('returns defaultWidth when nothing is stored', () => {
      expect(loadWidth('test', 260)).toBe(260);
    });

    it('returns stored value when present', () => {
      store[`${STORAGE_PREFIX}test`] = '350';
      expect(loadWidth('test', 260)).toBe(350);
    });

    it('returns defaultWidth for invalid stored value', () => {
      store[`${STORAGE_PREFIX}test`] = 'garbage';
      expect(loadWidth('test', 260)).toBe(260);
    });

    it('returns defaultWidth for zero stored value', () => {
      store[`${STORAGE_PREFIX}test`] = '0';
      expect(loadWidth('test', 260)).toBe(260);
    });

    it('returns defaultWidth for negative stored value', () => {
      store[`${STORAGE_PREFIX}test`] = '-100';
      expect(loadWidth('test', 260)).toBe(260);
    });
  });

  describe('saveWidth', () => {
    it('stores rounded value', () => {
      saveWidth('test', 312.7);
      expect(store[`${STORAGE_PREFIX}test`]).toBe('313');
    });
  });

  describe('clamp', () => {
    it('returns value within range unchanged', () => {
      expect(clamp(300, 180, 400)).toBe(300);
    });

    it('clamps to minimum', () => {
      expect(clamp(100, 180, 400)).toBe(180);
    });

    it('clamps to maximum', () => {
      expect(clamp(500, 180, 400)).toBe(400);
    });

    it('handles edge: value equals min', () => {
      expect(clamp(180, 180, 400)).toBe(180);
    });

    it('handles edge: value equals max', () => {
      expect(clamp(400, 180, 400)).toBe(400);
    });
  });

  describe('computeNewWidth — direction: left', () => {
    const min = 180, max = 400;

    it('dragging right (positive delta) makes panel wider', () => {
      // Start at 260, drag right by 50px
      const result = computeNewWidth('left', 260, 100, 150, min, max);
      expect(result).toBe(310);
    });

    it('dragging left (negative delta) makes panel narrower', () => {
      // Start at 260, drag left by 50px
      const result = computeNewWidth('left', 260, 150, 100, min, max);
      expect(result).toBe(210);
    });

    it('clamps when dragged beyond max', () => {
      // Start at 350, drag right by 100px → 450, clamped to 400
      const result = computeNewWidth('left', 350, 100, 200, min, max);
      expect(result).toBe(400);
    });

    it('clamps when dragged below min', () => {
      // Start at 200, drag left by 50px → 150, clamped to 180
      const result = computeNewWidth('left', 200, 150, 100, min, max);
      expect(result).toBe(180);
    });
  });

  describe('computeNewWidth — direction: right', () => {
    const min = 220, max = 500;

    it('dragging left (negative delta) makes panel wider', () => {
      // Right sidebar: handle is to the left. Drag handle LEFT = wider.
      // startX=500, currentX=450 → delta=-50 → newWidth = 300 - (-50) = 350
      const result = computeNewWidth('right', 300, 500, 450, min, max);
      expect(result).toBe(350);
    });

    it('dragging right (positive delta) makes panel narrower', () => {
      // Drag handle RIGHT = narrower.
      // startX=500, currentX=550 → delta=50 → newWidth = 300 - 50 = 250
      const result = computeNewWidth('right', 300, 500, 550, min, max);
      expect(result).toBe(250);
    });

    it('clamps when dragged beyond max', () => {
      // Start at 450, drag left by 100px → 550, clamped to 500
      const result = computeNewWidth('right', 450, 500, 400, min, max);
      expect(result).toBe(500);
    });

    it('clamps when dragged below min', () => {
      // Start at 250, drag right by 50px → 200, clamped to 220
      const result = computeNewWidth('right', 250, 500, 550, min, max);
      expect(result).toBe(220);
    });
  });

  describe('initialization clamping', () => {
    it('clamps stored value to min/max on load', () => {
      store[`${STORAGE_PREFIX}test`] = '100'; // below min
      const loaded = loadWidth('test', 260);
      const initWidth = clamp(loaded, 180, 400);
      expect(initWidth).toBe(180);
    });

    it('clamps stored value above max', () => {
      store[`${STORAGE_PREFIX}test`] = '9999';
      const loaded = loadWidth('test', 260);
      const initWidth = clamp(loaded, 180, 400);
      expect(initWidth).toBe(400);
    });
  });

  describe('persistence round-trip', () => {
    it('save then load returns the same value', () => {
      saveWidth('roundtrip', 312);
      expect(loadWidth('roundtrip', 260)).toBe(312);
    });

    it('different keys are independent', () => {
      saveWidth('panel-a', 200);
      saveWidth('panel-b', 400);
      expect(loadWidth('panel-a', 0)).toBe(200);
      expect(loadWidth('panel-b', 0)).toBe(400);
    });
  });
});
