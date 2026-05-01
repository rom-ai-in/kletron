# Kletron CoWork Implementation Quick Reference

## Core Components

### Category Service (packages/server/src/services/categoryService.ts)
```typescript
// Built-in categories
const BUILT_IN_CATEGORIES = [
  { id: 'coding', name: 'Code Assistance', ... },
  { id: 'drafting', name: 'Document Drafting', ... },
  { id: 'automation', name: 'Workflow Automation', ... }
];

// Main functions
- getBuiltInCategories() - Returns all built-in categories
- getCategoryConfig(categoryId) - Gets configuration for specific category
- validateCategorySwitch(userId, fromCategory, toCategory) - Validates transition
- preserveContext(userId, fromCategory, toCategory) - Preserves context during switch
```

### Context Preservation (packages/server/src/context/preservation.ts)
```typescript
// Key methods
- extractTransferableContext(userId, category) - Extracts portable context
- transformForNewCategory(context, fromCat, toCat) - Adapts context for new category
- mergeWithTargetContext(userId, targetCat, context) - Combines with existing context
```

### Type Definitions (packages/shared/src/types.ts)
```typescript
interface WorkCategoryConfig {
  id: string;
  name: string;
  description: string;
  defaultPrompt: string;
  availableTools: string[];
  requiredContextTypes: string[];
  capabilities: Record<string, boolean>;
}

interface EnhancedContext {
  workCategory: string;
  domainSpecificContext: Record<string, any>;
  globalContext: GlobalContext;
}
```

## Usage Examples

### Switching Categories (Frontend)
```typescript
// In React component
const [currentCategory, setCurrentCategory] = useState('coding');

const handleCategoryChange = async (newCategory) => {
  const result = await api.switchCategory(newCategory);
  if (result.success) {
    setCurrentCategory(newCategory);
  }
};
```

### Category-Specific Tools (Backend)
```typescript
// In agent workflow
const tools = getToolsForCategory(currentCategory);
const context = await enhanceContextWithCategory(userInput, currentCategory);
const result = await executeAgentWorkflow(tools, context);
```

### Workspace Configuration
```typescript
// Create workspace with custom category
const workspaceConfig = {
  id: 'workspace-123',
  name: 'My Project',
  path: '/path/to/project',
  categories: [
    {
      categoryId: 'coding',
      customName: 'Backend Development',
      description: 'Focused on API and server-side code'
    }
  ],
  skills: ['research', 'testing'],
  connectors: ['git', 'docker']
};

await api.createWorkspace(workspaceConfig);
```

## Testing

### Run Category System Test
```bash
node scripts/test-category-system.js
```

### Expected Output
```
Testing category system...
✓ Built-in categories loaded: coding, drafting, automation
✓ All categories have required fields
✓ Coding category has expected tools: list_files, read_file, search_code
✓ Automation category has scheduling capability
✓ Workspace configuration structure valid
✓ Context preservation structure valid
✓ Category switching logic valid
  - Transitioning from coding to drafting
  - Preserved 2 context items
✅ All category system tests passed!
```

## API Endpoints

### Category Management
- `POST /api/work-categories` - Create custom work categories
- `GET /api/work-categories` - List available categories
- `POST /api/context/switch-category` - Switch active work category
- `GET /api/context/current` - Get current context including category

### Workspace Management
- `POST /api/workspaces` - Create new workspace with category config
- `PUT /api/workspaces/:id/categories` - Update workspace categories
- `GET /api/workspaces/:id/categories` - Get workspace-specific categories

## Configuration Files

### Built-in Categories
Location: `packages/shared/src/categoryConfig.ts`
```typescript
// Extend BUILT_IN_CATEGORIES array with new categories
const NEW_CATEGORY = {
  id: 'presentation',
  name: 'Presentation Design',
  description: 'Create and design presentations',
  defaultPrompt: 'You are a presentation designer...',
  availableTools: ['fetch_url', 'web_search'],
  requiredContextTypes: ['slide_template'],
  capabilities: { canEditFiles: false }
};
```

### Category-Specific Tools
Location: `packages/server/src/services/mcpServer.ts`
```typescript
// Add new tool categories
function buildPresentationTools() {
  return [
    {
      name: 'create_slides',
      description: 'Create presentation slides',
      parameters: { /* ... */ }
    }
  ];
}
```

## Troubleshooting

### Category Switch Fails
1. Check `categoryService.validateCategorySwitch()` logs
2. Verify context preservation in `preservation.ts`
3. Ensure user has permission for target category

### Tools Not Available
1. Verify tool is listed in category's `availableTools`
2. Check MCP server registration in `mcpServer.ts`
3. Confirm skill is enabled at workspace level

### Context Loss During Switch
1. Review `extractTransferableContext()` logic
2. Check `transformForNewCategory()` mappings
3. Verify database schema for `category_context` table

## Performance Tips

1. **Cache Category Configs**: Use in-memory cache for frequent category lookups
2. **Lazy Load Tools**: Load tools only when category is active
3. **Batch Context Preservation**: Combine multiple context operations
4. **Monitor Switch Times**: Track category transition performance
5. **Optimize Tool Selection**: Pre-filter tools by capability requirements

## Best Practices

1. **Keep Categories Focused**: Each category should have a clear, narrow purpose
2. **Document Capabilities**: Clearly define what each category can and cannot do
3. **Test Context Transitions**: Verify context preservation for all common transitions
4. **Provide Clear Feedback**: Show users what's happening during category switches
5. **Offer Quick Access**: Make category switching easy and discoverable
6. **Respect Workspace Boundaries**: Never access files outside the workspace root
7. **Secure Tool Execution**: Validate all tool parameters before execution
8. **Handle Errors Gracefully**: Provide recovery options when things go wrong
