"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kletron/ui/components/tabs";
import { Card } from "@kletron/ui/components/card";
import { Switch } from "@kletron/ui/components/switch";
import { Button } from "@kletron/ui/components/button";
import { SettingsLayout } from "../../../../components/layout/SettingsLayout";

interface Workspace {
    id: string;
    name: string;
}

interface Category {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
}

interface Skill {
    id: string;
    name: string;
    description: string;
    categoryId: string;
    isEnabled: boolean;
}

interface Connector {
    id: string;
    name: string;
    description: string;
    categoryId: string;
    isEnabled: boolean;
    configRequired: boolean;
}

export default function WorkspaceSettingsPage() {
    const router = useRouter();
    const { id: workspaceId } = router.query;

    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [connectors, setConnectors] = useState<Connector[]>([]);

    useEffect(() => {
        if (typeof workspaceId === 'string') {
            fetch(`/api/workspaces/${workspaceId}`)
                .then(res => res.json())
                .then(data => setWorkspace(data))
                .catch(err => console.error('Error fetching workspace:', err));

            fetch(`/api/workspaces/${workspaceId}/categories`)
                .then(res => res.json())
                .then(data => setCategories(data))
                .catch(err => console.error('Error fetching categories:', err));

            fetch(`/api/workspaces/${workspaceId}/skills`)
                .then(res => res.json())
                .then(data => setSkills(data))
                .catch(err => console.error('Error fetching skills:', err));

            fetch(`/api/workspaces/${workspaceId}/connectors`)
                .then(res => res.json())
                .then(data => setConnectors(data))
                .catch(err => console.error('Error fetching connectors:', err));
        }
    }, [workspaceId]);

    const handleToggleSkill = (skillId: string, isEnabled: boolean) => {
        fetch(`/api/workspaces/${workspaceId}/skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillId, isEnabled })
        })
        .then(() => {
            setSkills(prev => prev.map(s => 
                s.id === skillId ? { ...s, isEnabled } : s
            ));
        })
        .catch(err => console.error('Error updating skill:', err));
    };

    const handleToggleConnector = (connectorId: string, isEnabled: boolean) => {
        fetch(`/api/workspaces/${workspaceId}/connectors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectorId, isEnabled })
        })
        .then(() => {
            setConnectors(prev => prev.map(c => 
                c.id === connectorId ? { ...c, isEnabled } : c
            ));
        })
        .catch(err => console.error('Error updating connector:', err));
    };

    return (
        <SettingsLayout>
            <div className="container mx-auto px-4 py-6 flex-1">
                <h1 className="text-2xl font-bold mb-8">Workspace Settings</h1>

                {workspace && (
                    <div className="mb-8">
                        <h2 className="text-lg font-medium mb-2">{workspace.name}</h2>
                        <p className="text-sm text-subtle">Configure skills, connectors and categories for this workspace</p>
                    </div>
                )}

                <Tabs defaultValue="skills" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="skills">Skills</TabsTrigger>
                    <TabsTrigger value="connectors">Connectors</TabsTrigger>
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                </TabsList>

                <TabsContent value="skills" className="space-y-4">
                    <h2 className="text-lg font-medium mb-4">Skills</h2>
                    
                    {categories.map(category => (
                        <Card key={category.id} className="mb-4">
                            <div className="px-6 py-3 border-b border-subtle flex items-center gap-2">
                                <span className="text-xl" style={{ color: category.color }}>
                                    {category.icon}
                                </span>
                                <h3 className="font-medium">{category.name}</h3>
                            </div>
                            
                            <div className="p-6">
                                {skills.filter(s => s.categoryId === category.id).length > 0 ? (
                                    skills.filter(s => s.categoryId === category.id).map(skill => (
                                        <div key={skill.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
                                            <div>
                                                <div className="font-medium">{skill.name}</div>
                                                <div className="text-sm text-subtle">{skill.description}</div>
                                            </div>
                                            <Switch
                                                checked={skill.isEnabled}
                                                onCheckedChange={(checked) => handleToggleSkill(skill.id, checked)}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-subtle py-4">No skills available for this category</p>
                                )}
                            </div>
                        </Card>
                    ))}
                </TabsContent>

                <TabsContent value="connectors" className="space-y-4">
                    <h2 className="text-lg font-medium mb-4">Connectors</h2>
                    
                    {categories.map(category => (
                        <Card key={category.id} className="mb-4">
                            <div className="px-6 py-3 border-b border-subtle flex items-center gap-2">
                                <span className="text-xl" style={{ color: category.color }}>
                                    {category.icon}
                                </span>
                                <h3 className="font-medium">{category.name}</h3>
                            </div>
                            
                            <div className="p-6">
                                {connectors.filter(c => c.categoryId === category.id).length > 0 ? (
                                    connectors.filter(c => c.categoryId === category.id).map(connector => (
                                        <div key={connector.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
                                            <div>
                                                <div className="font-medium">{connector.name}</div>
                                                <div className="text-sm text-subtle">{connector.description}</div>
                                                {connector.configRequired && (
                                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mt-1 inline-block">Configuration Required</span>
                                                )}
                                            </div>
                                            <Switch
                                                checked={connector.isEnabled}
                                                onCheckedChange={(checked) => handleToggleConnector(connector.id, checked)}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-subtle py-4">No connectors available for this category</p>
                                )}
                            </div>
                        </Card>
                    ))}
                </TabsContent>

                <TabsContent value="categories" className="space-y-4">
                    <h2 className="text-lg font-medium mb-4">Categories</h2>
                    
                    {categories.map(category => (
                        <Card key={category.id} className="mb-4">
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-xl" style={{ color: category.color }}>
                                        {category.icon}
                                    </span>
                                    <h3 className="text-lg font-medium">{category.name}</h3>
                                </div>
                                
                                {category.description && (
                                    <p className="text-sm text-subtle mb-4">{category.description}</p>
                                )}
                            </div>
                        </Card>
                    ))}
                </TabsContent>
            </Tabs>
        </div>
        </SettingsLayout>
    );
}