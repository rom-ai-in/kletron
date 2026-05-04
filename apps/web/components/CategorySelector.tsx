"use client";

import { useState, useEffect } from "react";

interface Category {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
}

interface CategorySelectorProps {
    currentCategory: string;
    workspaceId: string;
    onSelect: (categoryId: string) => void;
}

export function CategorySelector({ currentCategory, workspaceId, onSelect }: CategorySelectorProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (workspaceId) {
            fetch(`/api/workspaces/${workspaceId}/categories`)
                .then(res => res.json())
                .then(data => setCategories(data))
                .catch(err => console.error('Error fetching categories:', err));
        }
    }, [workspaceId]);

    const currentCat = categories.find(c => c.id === currentCategory) || categories[0];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface hover:bg-surface-hover border border-subtle"
            >
                <div className="flex items-center gap-3">
                    {currentCat?.icon && (
                        <span className="text-xl" style={{ color: currentCat.color }}>
                            {currentCat.icon}
                        </span>
                    )}
                    <div>
                        <div className="font-medium">{currentCat?.name || 'Select Category'}</div>
                        {currentCat?.description && (
                            <div className="text-xs text-subtle">{currentCat.description}</div>
                        )}
                    </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isOpen ? "transform rotate-180" : ""}>
                    <path d="M7 13l5 5 5-5z"/>
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 w-full bg-surface-elevated rounded-lg shadow-lg border border-subtle z-50 max-h-64 overflow-y-auto">
                    {categories.map(category => (
                        <button
                            key={category.id}
                            onClick={() => {
                                onSelect(category.id);
                                setIsOpen(false);
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-surface flex items-center gap-3 ${currentCategory === category.id ? 'bg-primary/10' : ''}`}
                        >
                            {category.icon && (
                                <span className="text-xl" style={{ color: category.color }}>
                                    {category.icon}
                                </span>
                            )}
                            <div>
                                <div className="font-medium">{category.name}</div>
                                {category.description && (
                                    <div className="text-xs text-subtle">{category.description}</div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}