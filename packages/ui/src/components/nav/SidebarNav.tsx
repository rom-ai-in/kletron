'use client';

/**
 * Claude-style primary navigation primitives.
 *
 * Single source of truth for the sidebar look shared by the web app rail
 * (`Sidebar`) and the thread rail on web and desktop (`ProjectSidebar`):
 * a segmented Work/Code pill on top, then flat rows with a muted 15px icon,
 * a 13px label and an optional uppercase badge.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Segmented control (Work | Code) ────────────────────────────────────────

export interface SidebarSegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Native tooltip / description. */
  title?: string;
}

export interface SidebarSegmentedProps<T extends string> {
  options: readonly SidebarSegmentedOption<T>[];
  /** `undefined` when none of the options is the current surface. */
  value: T | undefined;
  onChange: (id: T) => void;
  disabled?: boolean;
  /** Accessible name for the radio group. */
  ariaLabel: string;
  /** Compact density for horizontal bars (desktop primary nav). */
  dense?: boolean;
  className?: string;
}

export function SidebarSegmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  dense = false,
  className = '',
}: SidebarSegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-white/[0.06] bg-black/[0.18] p-1',
        className,
      )}
    >
      {options.map(({ id, label, icon: Icon, title }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            title={title ?? label}
            onClick={() => onChange(id)}
            className={cn(
              'inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-fast',
              dense ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[13px]',
              active
                ? 'bg-white/[0.09] text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {Icon ? (
              <Icon
                className={cn(
                  'shrink-0',
                  dense ? 'h-3.5 w-3.5' : 'h-[15px] w-[15px]',
                  active ? 'text-text-secondary' : 'opacity-60',
                )}
                aria-hidden
              />
            ) : null}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Nav row ────────────────────────────────────────────────────────────────

export interface SidebarNavItemProps {
  icon: LucideIcon;
  label: string;
  /** Small uppercase pill after the label (e.g. "Beta"). */
  badge?: string;
  active?: boolean;
  /** Disclosure state — emits `aria-expanded` instead of `aria-current`. */
  expanded?: boolean;
  /** Icon-only rail. */
  collapsed?: boolean;
  /** Compact density for horizontal bars (desktop primary nav). */
  dense?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** When set with `LinkComponent`, renders an anchor instead of a button. */
  href?: string;
  LinkComponent?: React.ElementType;
  title?: string;
  /** Right-aligned adornment (chevron, count…). */
  trailing?: React.ReactNode;
  className?: string;
}

const rowClass = (active: boolean, collapsed: boolean, dense: boolean, disabled: boolean) =>
  cn(
    'group flex items-center rounded-lg transition-colors duration-fast',
    dense ? 'text-[11px] font-medium' : 'text-[13px]',
    collapsed
      ? 'justify-center px-0 py-2'
      : dense
        ? 'gap-1.5 px-2 py-1'
        : 'gap-2.5 px-2 py-[7px]',
    active
      ? 'bg-state-selected text-text-primary'
      : 'text-text-secondary hover:bg-state-hover hover:text-text-primary',
    disabled && 'pointer-events-none opacity-40',
  );

export function SidebarNavItem({
  icon: Icon,
  label,
  badge,
  active = false,
  expanded,
  collapsed = false,
  dense = false,
  disabled = false,
  onClick,
  href,
  LinkComponent,
  title,
  trailing,
  className = '',
}: SidebarNavItemProps) {
  const content = (
    <>
      <Icon
        className={cn(
          'shrink-0 transition-colors',
          dense ? 'h-3.5 w-3.5' : 'h-[15px] w-[15px]',
          active ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary',
        )}
        aria-hidden
      />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {!collapsed && badge ? (
        <span className="shrink-0 rounded bg-white/[0.07] px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-wide text-text-muted">
          {badge}
        </span>
      ) : null}
      {!collapsed && trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );

  const shared = {
    title: title ?? (collapsed ? label : undefined),
    ...(expanded === undefined
      ? { 'aria-current': active ? ('page' as const) : undefined }
      : { 'aria-expanded': expanded }),
    className: cn(rowClass(active, collapsed, dense, disabled), className),
  };

  if (href && LinkComponent) {
    const Link = LinkComponent;
    return (
      <Link href={href} {...shared}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} {...shared}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} {...shared}>
      {content}
    </button>
  );
}

/** Vertical stack with the spacing Claude uses between nav rows. */
export function SidebarNavGroup({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('flex flex-col gap-0.5', className)}>{children}</div>;
}
