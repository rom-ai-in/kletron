// Test component for category selector
import React from 'react';
import { CategorySelector } from '@kletron/ui/components/CommandCenter/CategorySelector';

export function CategorySelectorTest() {
  const categories = [
    { id: 'coding', name: 'Code', description: 'AI-powered code assistance', color: '#3B82F6' },
    { id: 'general', name: 'General', description: 'General purpose assistance', color: '#6B7280' },
    { id: 'drafting', name: 'Draft', description: 'Document creation and editing', color: '#10B981' },
    { id: 'automation', name: 'Automate', description: 'Workflow automation', color: '#F59E0B' }
  ];

  const [activeCategory, setActiveCategory] = React.useState('coding');

  return (
    <div className="p-8 bg-[#1c1c20] min-h-screen">
      <h1 className="text-xl font-bold mb-4 text-white">Category Selector Test</h1>
      <p className="text-gray-300 mb-6">Active category: {activeCategory}</p>
      
      <div className="mb-8">
        <CategorySelector
          categories={categories}
          activeCategoryId={activeCategory}
          onCategorySelect={(categoryId) => {
            console.info('Selected category:', categoryId);
            setActiveCategory(categoryId);
          }}
        />
      </div>

      <div className="text-gray-400">
        <h2 className="font-semibold mb-2">Available Categories:</h2>
        <ul className="list-disc list-inside space-y-1">
          {categories.map((category) => (
            <li key={category.id}>
              <span className={`inline-block w-3 h-3 rounded-full mr-2`} style={{ backgroundColor: category.color }}></span>
              {category.name} - {category.description}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
