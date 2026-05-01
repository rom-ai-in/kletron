// apps/web/components/workspaces/WorkspaceCategoryManager.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kletron/ui/button';
import { Card } from '@kletron/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kletron/ui/select';
import { Checkbox } from '@kletron/ui/checkbox';
import { Label } from '@kletron/ui/label';
import { Input } from '@kletron/ui/input';
import { Badge } from '@kletron/ui/badge';
import { WorkCategoryConfig, BUILT_IN_CATEGORIES } from '@kletron/shared/categoryTypes';

interface WorkspaceCategoryManagerProps {
  workspaceId: string;
  currentCategories?: any[];
  onSave?: () => void;
}

export function WorkspaceCategoryManager({ workspaceId, currentCategories = [], onSave }: WorkspaceCategoryManagerProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(currentCategories);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Get all available categories (built-in + workspace-specific)
  const allCategories: WorkCategoryConfig[] = Object.entries(BUILT_IN_CATEGORIES).map(([id, config]) => ({
    id,
    ...config
  }));

  const getAvailableToolsForCategory = (categoryId: string) => {
    // In a real implementation, this would fetch from the API
    return ['tool1', 'tool2', 'tool3'];
  };

  const handleToggleCategory = async (categoryId: string) => {
    try {
      setLoading(true);
      
      // Check if category already exists in workspace
      const existing = categories.find(c => c.id === categoryId);
      
      if (existing) {
        // Remove from workspace
        const response = await fetch(`/api/workspaces/${workspaceId}/categories`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId })
        });
        
        if (response.ok) {
          setCategories(categories.filter(c => c.id !== categoryId));
        }
      } else {
        // Add to workspace
        const response = await fetch(`/api/workspaces/${workspaceId}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId })
        });
        
        if (response.ok) {
          const data = await response.json();
          setCategories([...categories, data.data]);
        }
      }
    } catch (error) {
      console.error('Error toggling workspace category:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (categoryId: string, updates: any) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, ...updates })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCategories(categories.map(c => c.id === categoryId ? data.data : c));
      }
    } catch (error) {
      console.error('Error updating workspace category:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (onSave) onSave();
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Workspace Categories</h3>
        <Button onClick={handleSave} disabled={loading}>
          Save Configuration
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Configure which categories are available for this workspace and customize their settings.
      </p>

      <div className="space-y-4">
        {allCategories.map((category) => {
          const workspaceCategory = categories.find(c => c.id === category.id);
          const isEnabled = !!workspaceCategory;

          return (
            <Card key={category.id} className="p-4 border-dashed">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`category-${category.id}`}
                    checked={isEnabled}
                    onCheckedChange={() => handleToggleCategory(category.id)}
                  />
                  <Label htmlFor={`category-${category.id}`} className="font-medium">
                    {category.name}
                  </Label>
                  <Badge variant="secondary" className="text-xs ml-2">
                    {category.workspaceSpecific ? 'Workspace-Specific' : 'Global'}
                  </Badge>
                </div>
              </div>

              {isEnabled && (
                <div className="ml-8 space-y-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`custom-name-${category.id}`} className="text-sm">Custom Name:</Label>
                    <Input
                      id={`custom-name-${category.id}`}
                      value={workspaceCategory?.customName || ''}
                      onChange={(e) => handleUpdateCategory(category.id, { customName: e.target.value })}
                      placeholder="Enter custom name"
                      className="h-8 w-64"
                    />
                  </div>

                  <div className="flex items-start gap-2">
                    <Label htmlFor={`tools-${category.id}`} className="text-sm mt-1">Available Tools:</Label>
                    <div className="space-y-1 flex-1 max-w-md">
                      {getAvailableToolsForCategory(category.id).map((tool) => (
                        <div key={tool} className="flex items-center gap-2">
                          <Checkbox id={`tool-${category.id}-${tool}`} defaultChecked />
                          <Label htmlFor={`tool-${category.id}-${tool}`} className="text-sm">
                            {tool}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    {category.description}
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Card>
  );
}

// Helper component to display current workspace categories
interface WorkspaceCategoriesDisplayProps {
  workspaceId: string;
  categories?: any[];
}

export function WorkspaceCategoriesDisplay({ workspaceId, categories = [] }: WorkspaceCategoriesDisplayProps) {
  return (
    <div className="space-y-2">
      {categories.map((category) => (
        <Card key={category.id} className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{category.name}</span>
            {category.customName && (
              <Badge variant="outline" className="text-xs">
                Custom: {category.customName}
              </Badge>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}