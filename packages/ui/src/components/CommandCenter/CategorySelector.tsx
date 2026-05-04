'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { normalizeToWorkModeId } from '@kletron/shared/workMode';

export interface WorkCategory {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface CategorySelectorProps {
  categories: WorkCategory[];
  activeCategoryId: string;
  onCategorySelect: (categoryId: string) => void;
}

export function CategorySelector({ categories, activeCategoryId, onCategorySelect }: CategorySelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const mode = normalizeToWorkModeId(activeCategoryId);
  const activeCategory = categories.find(c => c.id === mode);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-150 ${
          isOpen
            ? 'bg-white/[0.08] text-text-primary'
            : 'text-text-muted hover:text-text-primary hover:bg-white/[0.06]'
        }`}
        title="Code or Work mode"
      >
        <span className="truncate max-w-[120px]">{activeCategory?.name || 'Category'}</span>
        <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[240px] max-w-[300px] rounded-lg border border-white/[0.08] py-1" style={{ backgroundColor: '#1c1c20', boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)' }}>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Mode
          </div>

          {categories.map((category) => {
            const isActive = category.id === mode;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onCategorySelect(category.id);
                }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-all duration-150 ${
                  isActive
                    ? 'bg-white/[0.06] text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.06]'
                }`}
              >
                <div className="w-4 flex-shrink-0 flex items-center justify-center">
                  {isActive && (
                    <div className="h-2 w-2 rounded-full bg-accent-cyan" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate">{category.name}</div>
                  <div className="text-[10px] text-text-muted truncate">{category.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}