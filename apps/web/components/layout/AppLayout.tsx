"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

interface LayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: LayoutProps) {
    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Top header */}
            <header className="border-b border-border bg-surface/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold text-foreground">Kletron</Link>
                    <nav className="flex items-center gap-2">
                        <Link
                            href="/app/settings"
                            className="p-2 rounded-lg hover:bg-surface"
                            title="Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Main content area */}
            <main className="flex-1 overflow-hidden flex">
                {children}
            </main>
        </div>
    );
}