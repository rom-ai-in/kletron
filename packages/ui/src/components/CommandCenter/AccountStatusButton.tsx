'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserCircle, ExternalLink, LogOut, Settings, Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import { getAvatarGradient, getInitials } from '../../lib/avatar';

/** Mirrors the desktop `SessionStatus` — kept structural so the UI package stays app-agnostic. */
export type AccountSessionStatus =
  | 'unconfigured'
  | 'signed-out'
  | 'signing-in'
  | 'active'
  | 'refreshing'
  | 'expired'
  | 'offline';

export interface AccountStatusButtonProps {
  status: AccountSessionStatus;
  email?: string | null;
  fullName?: string | null;
  userId?: string | null;
  /** Host shown in the status line, e.g. `localhost:3000`. */
  backendLabel?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  /** In-app account section (desktop Settings → Account). */
  onOpenAccount?: () => void;
  /** Full account page in the browser. */
  onOpenPortal?: () => void;
  /**
   * `chip` — avatar only, for a title bar. `row` — full-width identity row for
   * the top of a sidebar (avatar, name, connection status, chevron).
   */
  variant?: 'chip' | 'row';
  className?: string;
}

type Presentation = {
  /** Colour of the badge on the avatar. */
  dot: string;
  label: string;
  detail: (backend: string | null) => string;
  /** Signed-in-ish states show the avatar; the others show a "Sign in" pill. */
  identity: boolean;
};

const PRESENTATION: Record<AccountSessionStatus, Presentation> = {
  active: {
    dot: 'bg-status-success',
    label: 'Connected',
    detail: (b) => (b ? `Connected · ${b}` : 'Connected'),
    identity: true,
  },
  refreshing: {
    dot: 'bg-status-warning',
    label: 'Renewing session',
    detail: (b) => (b ? `Renewing session · ${b}` : 'Renewing session'),
    identity: true,
  },
  offline: {
    dot: 'bg-status-error',
    label: 'Backend unreachable',
    detail: (b) => (b ? `Cannot reach ${b}` : 'Backend unreachable'),
    identity: true,
  },
  expired: {
    dot: 'bg-status-error',
    label: 'Session expired',
    detail: () => 'Session expired — sign in again',
    identity: false,
  },
  'signing-in': {
    dot: 'bg-status-warning',
    label: 'Signing in…',
    detail: () => 'Waiting for the browser…',
    identity: false,
  },
  'signed-out': {
    dot: 'bg-text-muted',
    label: 'Signed out',
    detail: () => 'Signed out',
    identity: false,
  },
  unconfigured: {
    dot: 'bg-text-muted',
    label: 'No backend',
    detail: () => 'Set a Backend URL to sign in',
    identity: false,
  },
};

/**
 * Title-bar account chip: a 22px avatar with a status badge, plus a macOS-style menu.
 * Signed out it collapses to a "Sign in" pill so the state doubles as the affordance.
 */
export function AccountStatusButton({
  status,
  email,
  fullName,
  userId,
  backendLabel,
  onSignIn,
  onSignOut,
  onOpenAccount,
  onOpenPortal,
  variant = 'chip',
  className = '',
}: AccountStatusButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const presentation = PRESENTATION[status];
  const signedIn = presentation.identity;
  const isRow = variant === 'row';

  const displayName = useMemo(() => {
    const name = fullName?.trim();
    if (name) return name;
    const local = email?.split('@')[0];
    return local || 'Account';
  }, [fullName, email]);

  const initials = useMemo(() => getInitials(fullName, email), [fullName, email]);
  const gradient = useMemo(
    () => getAvatarGradient(userId || email || 'kletron'),
    [userId, email],
  );

  // Close on outside click / Esc, and move focus into the menu like an NSMenu
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('button[data-menu-item]');
      if (!items || items.length === 0) return;
      e.preventDefault();
      const list = Array.from(items);
      const current = list.findIndex((el) => el === document.activeElement);
      const next =
        e.key === 'ArrowDown'
          ? (current + 1 + list.length) % list.length
          : (current - 1 + list.length) % list.length;
      list[next < 0 ? 0 : next]?.focus();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const itemClass =
    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-text-secondary transition-all duration-150 hover:bg-white/[0.06] hover:text-text-primary focus:bg-white/[0.06] focus:text-text-primary focus:outline-none disabled:opacity-50';

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={signedIn ? `${displayName} — ${presentation.label}` : presentation.label}
        title={`${signedIn ? `${displayName} — ` : ''}${presentation.detail(backendLabel ?? null)}`}
        className={
          isRow
            ? `flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 ${
                open ? 'bg-white/[0.08]' : 'hover:bg-white/[0.06]'
              }`
            : signedIn
              ? `flex items-center rounded-full p-0.5 transition-all duration-150 ${
                  open ? 'bg-white/[0.10]' : 'hover:bg-white/[0.06]'
                }`
              : `flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-150 ${
                  open
                    ? 'bg-white/[0.08] text-text-primary'
                    : 'text-text-muted hover:bg-white/[0.06] hover:text-text-primary'
                }`
        }
      >
        {isRow ? (
          <>
            <span className="relative block shrink-0">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr ${gradient} text-[11px] font-semibold text-text-primary shadow-sm`}
              >
                {signedIn ? initials : <UserCircle className="h-4 w-4" aria-hidden />}
              </span>
              <span
                className={`absolute -bottom-px -right-px h-[8px] w-[8px] rounded-full ring-2 ring-black/50 ${presentation.dot}`}
                aria-hidden
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-text-primary">
                {signedIn ? displayName : presentation.label}
              </span>
              <span className="block truncate text-[10px] text-text-muted">
                {signedIn ? email ?? presentation.label : backendLabel ?? ''}
              </span>
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </>
        ) : signedIn ? (
          <span className="relative block">
            <span
              className={`flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gradient-to-tr ${gradient} text-[9px] font-semibold text-text-primary shadow-sm`}
            >
              {initials}
            </span>
            <span
              className={`absolute -bottom-px -right-px h-[7px] w-[7px] rounded-full ring-2 ring-black/50 ${presentation.dot}`}
              aria-hidden
            />
          </span>
        ) : (
          <>
            {status === 'signing-in' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <UserCircle className="h-3.5 w-3.5" />
            )}
            {status === 'signing-in' ? 'Signing in…' : 'Sign in'}
          </>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={`absolute top-full z-50 mt-1.5 min-w-[260px] max-w-[320px] rounded-lg border border-white/[0.08] py-1 ${
            isRow ? 'left-0' : 'right-0'
          }`}
          style={{
            backgroundColor: '#1c1c20',
            boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)',
          }}
        >
          {/* Identity header */}
          <div className="flex items-center gap-2.5 px-3 py-2">
            {signedIn ? (
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${gradient} text-[11px] font-semibold text-text-primary shadow-sm`}
              >
                {initials}
              </span>
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-text-muted">
                <UserCircle className="h-4 w-4" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-text-primary">
                {signedIn ? displayName : 'Not signed in'}
              </div>
              <div className="truncate text-[10px] text-text-muted">
                {signedIn ? email || '—' : presentation.label}
              </div>
            </div>
          </div>

          {/* Status line */}
          <div className="flex items-center gap-2 px-3 pb-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${presentation.dot}`} aria-hidden />
            <span className="truncate text-[10px] text-text-muted">
              {presentation.detail(backendLabel ?? null)}
            </span>
          </div>

          <div className="mx-2 my-1 border-t border-white/[0.06]" />

          {signedIn ? (
            <>
              {onOpenAccount && (
                <button
                  type="button"
                  data-menu-item
                  role="menuitem"
                  className={itemClass}
                  onClick={() => {
                    setOpen(false);
                    onOpenAccount();
                  }}
                >
                  <Settings className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">Account…</span>
                  <span className="text-[10px] text-text-muted">⌘,</span>
                </button>
              )}
              {onOpenPortal && (
                <button
                  type="button"
                  data-menu-item
                  role="menuitem"
                  className={itemClass}
                  onClick={() => {
                    setOpen(false);
                    onOpenPortal();
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">Open account in browser</span>
                </button>
              )}
              <div className="mx-2 my-1 border-t border-white/[0.06]" />
              <button
                type="button"
                data-menu-item
                role="menuitem"
                className={`${itemClass} text-status-error-text hover:text-status-error-text focus:text-status-error-text`}
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">Sign out</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              data-menu-item
              role="menuitem"
              className={itemClass}
              disabled={status === 'unconfigured' || status === 'signing-in'}
              onClick={() => {
                setOpen(false);
                onSignIn();
              }}
            >
              {status === 'signing-in' ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="flex-1">
                {status === 'signing-in' ? 'Waiting for the browser…' : 'Sign in…'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
