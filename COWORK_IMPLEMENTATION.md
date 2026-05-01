# CoWork-Style Implementation for Kletron

## Overview

This document describes the implementation of a CoWork-style app within Kletron, allowing users to switch between different work categories (coding, drafting, automation, general) while maintaining workspace/project context isolation.

## Architecture

### Core Components

1. **Workspace Categories System**
   - Defined in `packages/shared/src/workspaceCategories.ts`
   - Four main categories: coding, drafting, automation, general
   - Each category has specific tools, skills, and prompt templates

2. **Category-Specific Services**
   - `packages/server/src/services/workspaceCategoryService.ts`
   - Manages workspace-specific category configurations
   - Handles skill and connector configurations per workspace/category

3. **API Endpoints**
   - Workspace categories: `/api/workspaces/[workspaceId]/categories`
   - Workspace automations: `/api/workspaces/[workspaceId]/automations`
   - Category-specific automations: `/api/workspaces/[workspaceId]/categories/[categoryId]/automations`

4. **Frontend Components**
   - `WorkspaceCategorySelector`: Dropdown to switch categories
   - `WorkspaceSidebar`: Navigation with category-specific tools
   - `CategorySpecificInput`: Input field tailored to current category
   - Workbench page: Main interface at `/app/[workspaceId]/workbench`

## Key Features

### 1. Category Switching
- Users can switch between categories while maintaining workspace context
- Each category has different tools, skills, and UI elements
- Context is preserved when switching between categories

### 2. Workspace Isolation
- All operations are scoped to a specific workspace
- File access is restricted to the workspace directory
- Skills and connectors can be enabled/disabled per workspace

### 3. Category-Specific Functionality

#### Coding Category
- Tools: file system, git, code analysis, testing
- Skills: code review, implementation, testing, debugging
- UI: file explorer, search, configuration options

#### Drafting Category
- Tools: document management, web research, formatting
- Skills: technical writing, documentation, summarization
- UI: document templates, formatting options

#### Automation Category
- Tools: task execution, scheduling, integration
- Skills: workflow design, task automation, scheduling
- UI: schedules, connectors configuration

#### General Category
- Tools: web search, research, general tools
- Skills: research, explanation, brainstorming
- UI: simple text input/output

### 4. Automations System
- Create workspace-specific automations
- Schedule-based or trigger-based execution
- Category-specific automation templates
- API endpoints for CRUD operations

## Implementation Details

### Backend Changes

1. **Database Schema**
   - `workspace_category_configs`: Category configurations per workspace
   - `workspace_skill_configs`: Skill enablement per workspace/category
   - `workspace_connector_configs`: Connector configurations per workspace/category

2. **Service Layer**
   - `getCategoryConfig()`: Get category config for a workspace
   - `listWorkspaceCategories()`: List all categories for a workspace
   - `updateCategoryConfig()`: Update category configuration
   - `initializeDefaultWorkspaceConfigs()`: Set up default configs for new workspaces

3. **API Endpoints**
   ```typescript
   // GET /api/workspaces/[workspaceId]/categories
   // Returns all available categories with workspace-specific config
   
   // POST /api/workspaces/[workspaceId]/categories
   // Updates category configuration
   
   // GET /api/workspaces/[workspaceId]/automations
   // Returns all automations for a workspace
   
   // POST /api/workspaces/[workspaceId]/automations
   // Creates a new automation
   ```

### Frontend Changes

1. **Workspace Sidebar**
   - Shows available categories with icons and descriptions
   - Displays category-specific tools and options
   - Highlights current active category

2. **Category Selector**
   - Dropdown component for switching categories
   - Shows category icon, name, and description
   - Maintains state across the application

3. **Category-Specific Input**
   - Different input fields based on current category
   - Coding: "Ask about code..."
   - Drafting: "Ask about documents..."
   - Automation: "Describe automation..."
   - General: "Ask anything..."

4. **Workbench Page**
   - Main interface at `/app/[workspaceId]/workbench`
   - Combines sidebar, category selector, chat area, and input
   - Responsive layout for different screen sizes

## Usage Examples

### Switching Categories
```typescript
// In a React component
const [currentCategory, setCurrentCategory] = useState('coding');

return (
    <WorkspaceCategorySelector
        currentCategory={currentCategory}
        onSelect={setCurrentCategory}
        workspaceId="my-workspace"
    />
);
```

### Getting Category-Specific Tools
```typescript
import { CATEGORY_TOOL_GROUPS } from '@kletron/shared';

const codingTools = CATEGORY_TOOL_GROUPS.coding;
// Returns: ["file_system", "git", "code_analysis", "testing"]
```

### Creating an Automation
```typescript
fetch('/api/workspaces/my-workspace/automations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'Daily Backup',
        description: 'Backup repository daily',
        categoryId: 'automation',
        config: {
            schedule: '0 2 * * *',
            command: 'git push backup main'
        }
    })
})
```

## Migration Path

### From Current Implementation
1. The existing workspace system already supports context isolation
2. Skills and connectors are workspace-aware
3. Category definitions are new but follow existing patterns

### Required Changes
1. Add category selection UI to workbench
2. Update agent routing to consider categories
3. Enhance context management for cross-category transitions
4. Add automation system integration

## Testing Strategy

### Unit Tests
- Test category configuration service methods
- Test API endpoints with mock data
- Test frontend component rendering

### Integration Tests
- Test category switching flow
- Test workspace isolation
- Test automation creation and execution

### End-to-End Tests
- Create workspace → Switch categories → Verify context preservation
- Create automation → Verify it appears in correct category
- Test file access restrictions per workspace

## Future Enhancements

1. **Custom Categories**
   - Allow users to create custom work categories
   - Define custom tools and skills for each category

2. **Category Templates**
   - Predefined templates for common workflows
   - Import/export category configurations

3. **Collaboration Features**
   - Share categories across team members
   - Real-time collaboration in specific categories

4. **Advanced Automations**
   - Visual automation builder
   - Conditional logic and branching
   - Error handling and recovery scenarios

## Summary

The CoWork-style implementation transforms Kletron into a multi-category productivity app while maintaining its strong coding foundation. Key benefits:

- **Flexibility**: Switch between different types of work seamlessly
- **Context Isolation**: Each workspace maintains separate context per category
- **Extensibility**: Easy to add new categories and tools
- **Productivity**: Category-specific UI and tools improve workflow efficiency
- **Automation**: Built-in automation system for repetitive tasks

The implementation leverages existing Kletron features (workspaces, skills, connectors) and extends them with a category-based approach similar to Claude CoWork.
