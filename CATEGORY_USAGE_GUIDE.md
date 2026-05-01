# Category System Usage Guide

## Overview
The Kletron Category System allows users to switch between different work domains while maintaining context and configurations specific to each workspace.

## Basic Usage

### Switching Categories
```typescript
// Set current category for user
await setCurrentCategory('user-123', 'coding');

// Get current category
const current = await getCurrentCategory('user-123'); // Returns: 'coding'
```

### Getting Available Categories
```typescript
// Get all built-in categories
const categories = await getAllCategories();
// Returns array of WorkCategoryConfig objects:
[
  {
    id: 'coding',
    name: 'Code Assistance',
    description: 'AI-powered code analysis, generation, and debugging',
    defaultPrompt: 'You are a senior software engineer...',
    availableTools: ['list_files', 'read_file', ...],
    capabilities: { canEditFiles: true }
  },
  // ... other categories
]
```

### Workspace-Specific Categories
```typescript
// Get workspace-specific categories
const workspaceCategories = await getWorkspaceCategories('workspace-456');

// Create custom category for workspace
const customCategory = await createWorkspaceCategory(
  'workspace-456',
  'coding',
  {
    customName: 'My Custom Coding Setup',
    description: 'Special configuration for this project'
  }
);
```

## Frontend Integration

### Using CategorySelector Component

#### Basic Usage (Auto-fetch)
```tsx
import { CategorySelector } from '@/components/CategorySelector';

function MyComponent() {
  const [currentCategory, setCurrentCategory] = useState('coding');
  
  return (
    <CategorySelector
      currentCategory={currentCategory}
      onSelect={(categoryId) => setCurrentCategory(categoryId)}
    />
  );
}
```

#### Custom Categories (Prop-based)
```tsx
<CategorySelector
  currentCategory="coding"
  onSelect={handleCategoryChange}
  categories={[
    { id: 'coding', name: 'Coding', description: 'Code assistance' },
    { id: 'drafting', name: 'Drafting', description: 'Document creation' }
  ]}
/>
```

### Using useWorkCategories Hook

```tsx
import { useWorkCategories, useCurrentCategory } from '@/hooks/useWorkCategories';

function Workbench() {
  const { categories, isLoading, error } = useWorkCategories();
  const { currentCategory, setCurrentCategory } = useCurrentCategory();
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div>
      <h1>Welcome to {currentCategory}</h1>
      <CategorySelector
        currentCategory={currentCategory}
        onSelect={setCurrentCategory}
      />
    </div>
  );
}
```

## API Endpoints

### GET /api/work-categories
**Response**: Array of all available work categories
```json
[
  {
    "id": "coding",
    "name": "Code Assistance",
    "description": "AI-powered code analysis...",
    "icon": "💻",
    "color": "#3B82F6"
  }
]
```

### POST /api/work-categories/current
**Request Body**: `{ "categoryId": "coding" }`
**Response**: `{ "success": true, "currentCategory": "coding" }`

### GET /api/work-categories/current
**Response**: `{ "category": "coding", "history": ["automation", "drafting"] }`

### GET /api/work-categories/workspace
**Query Params**: `?workspaceId=123`
**Response**: Array of workspace-specific categories
```json
[
  {
    "id": "coding",
    "name": "Code Assistance",
    "customName": "My Custom Setup",
    "isActive": true
  }
]
```

### POST /api/work-categories/workspace
**Request Body**: 
```json
{
  "workspaceId": "123",
  "categoryId": "coding",
  "config": {
    "customName": "My Custom Coding",
    "description": "Special configuration"
  }
}
```
**Response**: Created workspace category object

## Category-Specific Features

### Coding Mode
- File tree navigation
- Code editing capabilities
- Terminal integration
- Git operations

### Drafting Mode
- Document templates
- Formatting tools
- Export options (Word, PDF)
- Collaboration features

### Automation Mode
- Workflow builder
- Task scheduling
- Calendar integration
- Email drafting

### General Mode
- Open-ended questions
- Research assistance
- Learning support
- Brainstorming

## Best Practices

1. **Context Preservation**: When switching categories, relevant context is automatically preserved
2. **Workspace Isolation**: Each workspace maintains its own category configurations
3. **User Preferences**: Category history and preferences are tracked per user
4. **Performance**: Only load tools and resources needed for current category
5. **Error Handling**: Graceful fallbacks when category switching fails

## Troubleshooting

### Common Issues

**Issue**: Category not switching properly
- Check: User has proper permissions
- Check: Workspace exists and is active
- Solution: Verify with `getCurrentCategory()` API

**Issue**: Tools not available in expected category
- Check: Tool is listed in category's `availableTools`
- Check: MCP server is running
- Solution: Update category configuration

**Issue**: Context lost after category switch
- Check: Context preservation settings
- Check: Workspace-specific context saved
- Solution: Review context management logs

## Examples

### Example 1: Basic Category Switching
```tsx
function CategorySwitcher() {
  const [category, setCategory] = useState('coding');
  
  return (
    <div>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="coding">Coding</option>
        <option value="drafting">Drafting</option>
        <option value="automation">Automation</option>
        <option value="general">General</option>
      </select>
      
      <CategorySelector
        currentCategory={category}
        onSelect={setCategory}
      />
    </div>
  );
}
```

### Example 2: Workspace-Specific Configuration
```typescript
// Create a custom coding setup for a specific workspace
const workspaceId = 'project-alpha-123';
await createWorkspaceCategory(workspaceId, 'coding', {
  customName: 'Backend Development',
  description: 'Focused on Node.js and TypeScript',
  customTools: ['node_debugger', 'typescript_linter']
});

// Later, retrieve this configuration
const workspaceCategories = await getWorkspaceCategories(workspaceId);
const backendConfig = workspaceCategories.find(
  c => c.id === 'coding' && c.customName === 'Backend Development'
);
```

### Example 3: Category-Aware Agent Routing
```typescript
async function handleUserRequest(userId, requestText) {
  // Get current category
  const currentCategory = await getCurrentCategory(userId);
  
  // Route to appropriate agent workflow
  if (currentCategory === 'coding') {
    return await codeAgent.handleRequest(requestText);
  } else if (currentCategory === 'drafting') {
    return await draftingAgent.handleRequest(requestText);
  } else {
    return await generalAgent.handleRequest(requestText);
  }
}
```

## Migration Guide

### From Single-Purpose to Multi-Category

1. **Identify Workflows**: Determine which user workflows map to categories
2. **Update UI**: Replace single-purpose interface with category selector
3. **Migrate Context**: Preserve existing context in new category structure
4. **Test Transitions**: Verify smooth switching between categories
5. **User Training**: Provide guidance on when to use each category

### From Other Systems

1. **Map Categories**: Align existing work types with Kletron's categories
2. **Custom Configurations**: Create workspace-specific overrides as needed
3. **Tool Integration**: Ensure all tools are properly categorized
4. **User Migration**: Import user preferences and history where possible
