import React, { useState } from 'react';
import { DEFAULT_WORK_CATEGORIES } from '@kletron/shared';
import type { WorkCategory } from "@kletron/shared";
import { normalizeToWorkModeId } from '@kletron/shared/workMode';

interface WorkspaceCategorySelectorProps {
    currentCategory: string;
    onSelect: (categoryId: string) => void;
    workspaceId?: string;
}

export const WorkspaceCategorySelector = ({
    currentCategory,
    onSelect,
    workspaceId
}: WorkspaceCategorySelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Get available categories (in production, these would come from the API)
    const categories: WorkCategory[] = DEFAULT_WORK_CATEGORIES;
    const mode = normalizeToWorkModeId(currentCategory);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover border border-subtle"
            >
                <span className="text-xl">
                    {categories.find(cat => cat.id === mode)?.icon || '🎯'}
                </span>
                <span className="font-medium">
                    {categories.find(cat => cat.id === mode)?.name || 'Mode'}
                </span>
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            {isOpen && (
                <div className="absolute top-full mt-1 w-64 bg-surface-elevated rounded-lg shadow-lg border border-subtle z-50 overflow-hidden">
                    {categories.map(category => (
                        <button
                            key={category.id}
                            onClick={() => {
                                onSelect(category.id);
                                setIsOpen(false);
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-surface flex items-center gap-3 ${mode === category.id ? 'bg-primary/10' : ''}`}
                        >
                            <span className="text-xl" style={{ color: category.color }}>
                                {category.icon}
                            </span>
                            <div>
                                <div className="font-medium text-foreground">
                                    {category.name}
                                </div>
                                <div className="text-sm text-subtle">
                                    {category.description}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
