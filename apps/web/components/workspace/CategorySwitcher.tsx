// CategorySwitcher.tsx - Inline category switcher
'use client';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from '@kletron/ui/components/ui/tabs';

interface CategorySwitcherProps {
    workspaceId: string;
}

export function CategorySwitcher({ workspaceId }: CategorySwitcherProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    const categories = [
        { id: 'coding', name: 'Coding', color: '#3b82f6' },
        { id: 'drafting', name: 'Drafting', color: '#10b981' },
        { id: 'automation', name: 'Automation', color: '#8b5cf6' },
        { id: 'general', name: 'General', color: '#6b7280' },
    ];

    const activeCategory = searchParams?.get('category') || 'coding';
    const [activeTab, setActiveTab] = useState(activeCategory);

    return (
        <Tabs
            value={activeTab}
            onValueChange={(value) => {
                setActiveTab(value);
                const params = new URLSearchParams(searchParams?.toString() || '');
                params.set('category', value);
                router.push(`${pathname}?${params.toString()}`, undefined, { shallow: true });
            }}
        >
            <TabsList className="grid grid-cols-4 gap-1 bg-transparent p-0">
                {categories.map((category) => (
                    <TabsTrigger
                        key={category.id}
                        value={category.id}
                        className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary h-8 px-2 py-1 text-xs"
                        style={{ borderColor: category.color }}
                    >
                        <span className="flex items-center gap-1">
                            {category.name}
                        </span>
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}
