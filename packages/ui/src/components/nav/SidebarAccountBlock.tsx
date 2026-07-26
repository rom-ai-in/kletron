'use client';

/**
 * The account row at the top of the web sidebar.
 *
 * Thin wrapper over `AccountStatusButton`, the same component the desktop shell
 * uses, so both apps render one identity control with one menu instead of two
 * that drift apart. Identity comes from the web `AuthContext`; the desktop
 * passes its own session status directly to `AccountStatusButton`.
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AccountStatusButton } from '../CommandCenter/AccountStatusButton';
import type { AccountSessionStatus } from '../CommandCenter/AccountStatusButton';

export interface SidebarAccountBlockProps {
    /** Icon-only rail — falls back to the compact avatar. */
    collapsed?: boolean;
    /** Opens the in-app account page. */
    onOpenAccount?: () => void;
    /** Where to send a signed-out user. Defaults to the login route. */
    onSignIn?: () => void;
    className?: string;
}

export function SidebarAccountBlock({
    collapsed = false,
    onOpenAccount,
    onSignIn,
    className = '',
}: SidebarAccountBlockProps) {
    const { user, profile, loading, signOut } = useAuth();

    // No backend-URL concept in the browser: the states that matter are
    // "still checking", "signed in" and "signed out".
    const status: AccountSessionStatus = loading ? 'refreshing' : user ? 'active' : 'signed-out';

    const handleSignIn = () => {
        if (onSignIn) return onSignIn();
        window.location.href = '/auth/login';
    };

    const handleSignOut = () => {
        void signOut().then(() => {
            window.location.href = '/auth/login';
        });
    };

    return (
        <AccountStatusButton
            variant={collapsed ? 'chip' : 'row'}
            status={status}
            email={user?.email}
            fullName={profile?.full_name}
            userId={user?.id}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onOpenAccount={onOpenAccount}
            className={className}
        />
    );
}
