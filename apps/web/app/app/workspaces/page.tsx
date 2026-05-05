"use client";

import { useState, useEffect } from "react";
import { Button } from "@kletron/ui/components/ui/Button";
import { Input } from "@kletron/ui/components/ui/Input";
import { Card } from "@kletron/ui/components/ui/Card";
import { Plus, Folder, Settings } from "lucide-react";

interface Workspace {
    id: string;
    name: string;
    rootPath?: string;
    description?: string;
    isActive?: boolean;
}

export default function WorkspacesPage() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newWorkspace, setNewWorkspace] = useState({ name: '', rootPath: '' });

    useEffect(() => {
        void fetchWorkspaces();
    }, []);

    const fetchWorkspaces = async () => {
        try {
            const res = await fetch('/api/workspaces');
            const data = await res.json();
            setWorkspaces(data);
            setIsLoading(false);
        } catch (err) {
            console.error('Error fetching workspaces:', err);
            setIsLoading(false);
        }
    };

    const handleAddWorkspace = async () => {
        try {
            const res = await fetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newWorkspace)
            });
            
            if (res.ok) {
                setShowAddForm(false);
                void fetchWorkspaces();
            }
        } catch (err) {
            console.error('Error adding workspace:', err);
        }
    };

    const handleSetActive = async (workspaceId: string) => {
        try {
            await fetch('/api/workspaces/active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId })
            });
            
            // Refresh workspaces
            void fetchWorkspaces();
        } catch (err) {
            console.error('Error setting active workspace:', err);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-foreground">Workspaces</h1>
                <Button onClick={() => setShowAddForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Workspace
                </Button>
            </div>

            {showAddForm && (
                <Card className="mb-6 p-6">
                    <h2 className="text-lg font-medium mb-4">Add New Workspace</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-subtle mb-1">Name</label>
                            <Input
                                value={newWorkspace.name}
                                onChange={(e) => setNewWorkspace({...newWorkspace, name: e.target.value})}
                                placeholder="My Project"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-subtle mb-1">Root Path</label>
                            <Input
                                value={newWorkspace.rootPath}
                                onChange={(e) => setNewWorkspace({...newWorkspace, rootPath: e.target.value})}
                                placeholder="/path/to/project"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setShowAddForm(false)}>Cancel</Button>
                        <Button onClick={handleAddWorkspace}>Create Workspace</Button>
                    </div>
                </Card>
            )}

            {isLoading ? (
                <div className="text-center py-8">Loading workspaces...</div>
            ) : workspaces.length === 0 ? (
                <div className="text-center py-8 text-subtle">No workspaces found. Add your first workspace.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workspaces.map(workspace => (
                        <Card key={workspace.id} className="p-6 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <Folder className="w-5 h-5 text-primary" />
                                    <h3 className="text-lg font-medium">{workspace.name}</h3>
                                </div>
                                {workspace.isActive && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Active</span>
                                )}
                            </div>

                            {workspace.description && (
                                <p className="text-sm text-subtle mb-3">{workspace.description}</p>
                            )}

                            {workspace.rootPath && (
                                <p className="text-xs text-subtle mb-4">Root: {workspace.rootPath}</p>
                            )}

                            <div className="flex gap-2">
                                {!workspace.isActive ? (
                                    <Button
                                        size="sm"
                                        onClick={() => handleSetActive(workspace.id)}
                                    >
                                        Set Active
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => window.location.href = "/app/agent"}
                                    >
                                        Open
                                    </Button>
                                )}
                                <Button size="sm" variant="secondary">
                                    <Settings className="w-4 h-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
