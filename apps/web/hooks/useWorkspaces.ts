"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";

interface Workspace {
    id: string;
    name: string;
    rootPath?: string;
    description?: string;
    isActive?: boolean;
}

interface Category {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    isDefault?: boolean;
}

export function useWorkspaces() {
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

    return { workspaces, isLoading };
}

export function useCurrentWorkspace() {
    const router = useRouter();
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCategory, setActiveCategory] = useState<Category | null>(null);

    useEffect(() => {
        // Get workspace ID from URL
        const workspaceId = router.query.workspaceId as string;
        
        if (!workspaceId) return;
        
        // Fetch active workspace
        fetch('/api/workspaces/active')
            .then(res => res.json())
            .then(data => {
                setCurrentWorkspace(data);
                
                // Set default category from workspace or URL param
                const urlCategory = router.query.category as string;
                const activeCatId = urlCategory || data.defaultCategoryId || 'coding';
                
                fetch(`/api/workspaces/${data.id}/categories`)
                    .then(res => res.json())
                    .then(cats => {
                        setCategories(cats);
                        const activeCat = cats.find((c: any) => c.id === activeCatId) || cats[0];
                        setActiveCategory(activeCat || null);
                    });
            })
            .catch(err => console.error('Error fetching active workspace:', err));
    }, [router.query.workspaceId, router.query.category]);

    return { currentWorkspace, categories, activeCategory };
}