"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@kletron/ui/components/card";
import { Button } from "@kletron/ui/components/button";
import { Plus } from "lucide-react";
import { AppLayout } from "../../components/layout/AppLayout";

interface Workspace {
    id: string;
    name: string;
    description?: string;
    isActive?: boolean;
}

export default function DashboardPage() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch('/api/workspaces')
            .then(res => res.json())
            .then(data => {
                setWorkspaces(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Error fetching workspaces:', err);
                setIsLoading(false);
            });
    }, []);

    return (
        <AppLayout>
            <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">Workspaces</h1>
                <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    New Workspace
                </Button>
            </div>

            {isLoading ? (
                <div className="text-center text-subtle py-8">Loading workspaces...</div>
            ) : workspaces.length === 0 ? (
                <div className="text-center text-subtle py-8">No workspaces found</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workspaces.map(workspace => (
                        <Link href={`/app/${workspace.id}/workbench`} key={workspace.id}>
                            <Card className="h-full transition-colors hover:bg-surface-hover cursor-pointer">
                                <div className="p-6 h-full flex flex-col">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xl">📁</span>
                                        <h2 className="text-lg font-medium">{workspace.name}</h2>
                                    </div>

                                    {workspace.description && (
                                        <p className="text-sm text-subtle mb-4 flex-grow">{workspace.description}</p>
                                    )}

                                    <div className="mt-auto pt-4">
                                        <Button variant="outline" size="sm" className="w-full justify-center">
                                            Open Workspace
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
        </AppLayout>
    );
}