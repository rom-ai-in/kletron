'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Camera, Image, Monitor } from 'lucide-react';

export interface MultimodalMenuProps {
  open: boolean;
  onClose: () => void;
  onIncludeFile?: () => void;
  onTakeScreenshot?: () => void;
  onTakePhoto?: () => void;
  className?: string;
}

export function MultimodalMenu({
  open,
  onClose,
  onIncludeFile,
  onTakeScreenshot,
  onTakePhoto,
  className = '',
}: MultimodalMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  const items = [
    {
      id: 'file',
      label: 'Include File / Photo',
      description: 'Upload a file or image from disk',
      icon: <FileUp className="h-4 w-4" />,
      onClick: onIncludeFile,
    },
    {
      id: 'screenshot',
      label: 'Take a Screenshot',
      description: 'Capture any window on your screen',
      icon: <Monitor className="h-4 w-4" />,
      onClick: onTakeScreenshot,
    },
    {
      id: 'photo',
      label: 'Take a Photo',
      description: 'Use camera to capture a sketch or diagram',
      icon: <Camera className="h-4 w-4" />,
      onClick: onTakePhoto,
      disabled: true, // future feature
    },
  ];

  return (
    <div
      ref={menuRef}
      className={`absolute bottom-full left-0 mb-1 w-64 rounded-lg border border-border-subtle bg-bg-elevated shadow-lg z-50 overflow-hidden ${className}`}
    >
      <div className="px-3 py-1.5 border-b border-border-subtle">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Attach</span>
      </div>
      <div className="py-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-text-secondary hover:bg-state-hover hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-text-muted">{item.icon}</span>
            <div className="min-w-0">
              <div className="text-xs font-medium">{item.label}</div>
              <div className="text-[10px] text-text-muted">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
