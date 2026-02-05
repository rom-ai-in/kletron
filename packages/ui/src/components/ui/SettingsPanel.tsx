'use client';

import React from 'react';
import { cn } from '@numezis/server/lib/utils';

export interface SettingsItem {
  id: string;
  label: string;
  description?: string;
  control: React.ReactNode;
}

export interface SettingsPanelProps {
  title?: string;
  description?: string;
  items: SettingsItem[];
  className?: string;
}

export function SettingsPanel({ title = 'Settings', description, items, className }: SettingsPanelProps) {
  return (
    <div className={cn('rounded-lg border border-border-subtle bg-bg-surface', className)}>
      <div className="border-b border-border-subtle px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">{title}</h3>
        {description && <p className="mt-1 text-[10px] text-text-muted">{description}</p>}
      </div>
      <div className="divide-y divide-border-subtle">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-text-primary truncate">{item.label}</div>
              {item.description && (
                <div className="text-[10px] text-text-muted truncate">{item.description}</div>
              )}
            </div>
            <div className="shrink-0">{item.control}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
