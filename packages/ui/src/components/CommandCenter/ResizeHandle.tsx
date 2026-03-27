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
 * - 6px hit zone, 2px visible line centered inside
 * - Subtle highlight on hover, full highlight on drag
 * - `col-resize` cursor
 */
export function ResizeHandle({
  onMouseDown,
  onDoubleClick,
  active = false,
  className = '',
}: ResizeHandleProps) {
  return (
    <div
      className={`relative flex-shrink-0 cursor-col-resize group ${className}`}
      style={{ width: 6 }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      role="separator"
      aria-orientation="vertical"
    >
      {/* Visible line */}
      <div
        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all duration-150 ${
          active
            ? 'w-[2px] bg-accent-cyan/60'
            : 'w-px bg-white/[0.06] group-hover:w-[2px] group-hover:bg-accent-cyan/40'
        }`}
      />
    </div>
  );
}
