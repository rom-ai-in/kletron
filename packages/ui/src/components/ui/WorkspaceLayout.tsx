'use client';

import React from 'react';
import { cn } from '../../lib/utils';

export interface WorkspaceLayoutProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  content?: React.ReactNode;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  sidebarClassName?: string;
  contentClassName?: string;
  asideClassName?: string;
  footerClassName?: string;
  sidebarWidth?: string;
  asideWidth?: string;
}

export function WorkspaceLayout({
  header,
  sidebar,
  content,
  aside,
  footer,
  className,
  headerClassName,
  sidebarClassName,
  contentClassName,
  asideClassName,
  footerClassName,
  sidebarWidth = 'w-64',
  asideWidth = 'w-80',
}: WorkspaceLayoutProps) {
  return (
    <div className={cn('flex h-full flex-col bg-bg-app text-text-primary', className)}>
      {header && (
        <div className={cn('flex-none border-b border-white/[0.06] bg-bg-surface/80', headerClassName)}>
          {header}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        {sidebar && (
          <aside className={cn('flex min-h-0 shrink-0 border-r border-white/[0.06] bg-bg-surface', sidebarWidth, sidebarClassName)}>
            {sidebar}
          </aside>
        )}
        <main className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', contentClassName)}>
          {content}
        </main>
        {aside && (
          <aside className={cn('flex min-h-0 shrink-0 border-l border-white/[0.06] bg-bg-surface', asideWidth, asideClassName)}>
            {aside}
          </aside>
        )}
      </div>
      {footer && (
        <div className={cn('flex-none border-t border-white/[0.06] bg-bg-surface', footerClassName)}>
          {footer}
        </div>
      )}
    </div>
  );
}
