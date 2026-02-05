'use client';
// src/components/AppShell.tsx
// Simple app shell that handles public routes - /app routes have their own layout
import React from 'react';

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    // All routes pass through - /app/* routes have their own layout with Sidebar
    // Public routes (/, /auth/*) render without shell
    return <>{children}</>;
}

