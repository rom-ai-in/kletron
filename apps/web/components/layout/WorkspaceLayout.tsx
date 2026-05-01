"use client";

import { WorkspaceSelector } from "../../../components/workspace/WorkspaceSelector";
import Link from "next/link";
import { Settings, Wrench, Link as LinkIcon } from "lucide-react";

interface LayoutProps {
    children: React.ReactNode;
    workspaceId?: string;
}

export function WorkspaceLayout({ children, workspaceId }: LayoutProps) {
    return (
        <div className="flex flex-col h-screen bg-background">
            <header className="border-b border-border bg-surface/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-xl font-bold text-foreground">Kletron</Link>
                        <WorkspaceSelector showCategories={true} />
                    </div>
                    {workspaceId && (
                        <nav className="flex items-center gap-1">
                            <Link
                                href={`/app/${workspaceId}/skills`}
                                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                title="Workspace skills"
                            >
                                <Wrench className="h-4 w-4" /> Skills
                            </Link>
                            <Link
                                href={`/app/${workspaceId}/connectors`}
                                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                title="Workspace connectors"
                            >
                                <LinkIcon className="h-4 w-4" /> Connectors
                            </Link>
                            <Link
                                href={`/app/${workspaceId}/settings`}
                                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                title="Workspace settings"
                            >
                                <Settings className="h-4 w-4" />
                            </Link>
                        </nav>
                    )}
                </div>
            </header>

            <main className="flex-1 overflow-hidden flex">
                {children}
            </main>
        </div>
    );
}