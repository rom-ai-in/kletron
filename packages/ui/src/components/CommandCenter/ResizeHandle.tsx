'use client';

import React from 'react';

export interface ResizeHandleProps {
  /** Called on mousedown to start the drag */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Called on double-click to reset to default width */
  onDoubleClick?: () => void;
  /** Whether the handle is actively being dragged */
  active?: boolean;
  /** Optional extra className */
  className?: string;
}

/**
 * A thin vertical drag handle placed between panels.
 *
 * - **Zero flex width** so adjacent panes meet with no gap (avoids a “double rule” look).
 * - ~20px hit zone centered on the seam via absolute positioning.
 * - 1px hairline (2px while dragging / hover).
 */
export function ResizeHandle({
  onMouseDown,
  onDoubleClick,
  active = false,
  className = '',
}: ResizeHandleProps) {
  return (
    <div className={`relative z-10 h-full w-0 shrink-0 overflow-visible ${className}`}>
      <div
        className="group absolute inset-y-0 left-1/2 flex w-5 min-w-[20px] -translate-x-1/2 cursor-col-resize justify-center"
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        role="separator"
        aria-orientation="vertical"
      >
        <div
          className={`h-full shrink-0 transition-all duration-150 ${
            active
              ? 'w-[2px] bg-accent-cyan/60'
              : 'w-px bg-white/[0.06] group-hover:w-[2px] group-hover:bg-accent-cyan/40'
          }`}
        />
      </div>
    </div>
  );
}
