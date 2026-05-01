"use client";

import { useState, useEffect } from "react";
import { WorkspaceSelector } from "../../../components/workspace/WorkspaceSelector";
import Link from "next/link";
import { Settings, Folder, Plus } from "lucide-react";

interface LayoutProps {
    children: React.ReactNode;
}

export function WorkspaceLayout({ children }: LayoutProps) {
    const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Top header with workspace selector */}
            <header className="border-b border-border bg-surface/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-xl font-bold text-foreground">Kletron</Link>
                        <WorkspaceSelector showCategories={true} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/app/${currentWorkspace || 'workspace-1'}/settings`}
                            className="p-2 rounded-lg hover:bg-surface"
                            title="Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main content area */}
            <main className="flex-1 overflow-hidden flex">
                {children}
            </main>
        </div>
    );
}