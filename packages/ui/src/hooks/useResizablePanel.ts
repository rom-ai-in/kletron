'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseResizablePanelOptions {
  /** Unique key for localStorage persistence (e.g. 'left-sidebar') */
  storageKey: string;
  /** Default width in pixels */
  defaultWidth: number;
  /** Minimum allowed width */
  minWidth: number;
  /** Maximum allowed width */
  maxWidth: number;
  /**
   * Direction the panel grows from:
   * - 'left': panel is on the left, handle on its right edge (drag right = wider)
   * - 'right': panel is on the right, handle on its left edge (drag left = wider)
   */
  direction: 'left' | 'right';
}

export interface UseResizablePanelReturn {
  /** Current panel width */
  width: number;
  /** Whether the panel is currently being dragged */
  isDragging: boolean;
  /** Call on mousedown on the resize handle to start dragging */
  startDrag: (e: React.MouseEvent) => void;
  /** Reset width to default */
  resetToDefault: () => void;
}

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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useResizablePanel({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  direction,
}: UseResizablePanelOptions): UseResizablePanelReturn {
  const [width, setWidth] = useState(() => {
    const w = loadWidth(storageKey, defaultWidth);
    return Math.max(minWidth, Math.min(maxWidth, w));
  });
  const [isDragging, setIsDragging] = useState(false);

  // Refs to avoid stale closures in mousemove/mouseup handlers
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);
  const widthRef = useRef(width);
  widthRef.current = width;

  const clamp = useCallback(
    (w: number) => Math.max(minWidth, Math.min(maxWidth, w)),
    [minWidth, maxWidth],
  );

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = widthRef.current;
      setIsDragging(true);
    },
    [],
  );

  // Attach global listeners while dragging
  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartXRef.current;
      const newWidth =
        direction === 'left'
          ? dragStartWidthRef.current + delta   // dragging handle right = wider
          : dragStartWidthRef.current - delta;  // dragging handle left = wider
      setWidth(clamp(newWidth));
    };

    const onMouseUp = () => {
      setIsDragging(false);
      saveWidth(storageKey, widthRef.current);
    };

    // Prevent text selection while dragging
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, direction, clamp, storageKey]);

  const resetToDefault = useCallback(() => {
    setWidth(defaultWidth);
    saveWidth(storageKey, defaultWidth);
  }, [defaultWidth, storageKey]);

  return { width, isDragging, startDrag, resetToDefault };
}
