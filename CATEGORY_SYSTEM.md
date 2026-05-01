# Category System

This document describes the category-based workflow system for Kletron.

## Overview

The category system allows users to switch between different work domains (coding, drafting, automation, etc.) while maintaining context and using appropriate tools for each domain.

## Architecture

### Core Components

1. **Category Service** (`packages/server/src/services/categoryService.ts`)
   - Manages built-in and workspace-specific categories
   - Handles category state (current category, history)
   - Provides CRUD operations for workspace categories

2. **Workspace Skills Manager** (`packages/agent-core/src/workspaceSkills.ts`)
   - Maps categories to appropriate skills/tools
   - Recommends skills based on workspace content

3. **Category Workflow Runner** (`packages/agent-core/src/categoryWorkflowRunner.ts`)
   - Routes requests to appropriate category
   - Builds category-specific system prompts
   - Handles automatic category detection

4. **API Routes** (`apps/server/routes/api/work-categories.ts`)
   - `/api/work-categories` - Manage categories
   - `/api/work-categories/workspace` - Workspace-specific categories
   - `/api/work-categories/current` - Current category state

## Built-in Categories

The system includes these built-in categories:

### Coding
- **ID**: `coding`
- **Description**: Code assistance, analysis, and generation
- **Tools**: File operations, code search, git integration
- **Capabilities**: Can edit files, access repository

### Drafting
- **ID**: `drafting`
- **Description**: Document creation and editing
- **Tools**: Web research, document templates
- **Capabilities**: Can create documents

### Automation
- **ID**: `automation`
- **Description**: Workflow automation and scheduling
- **Tools**: Calendar integration, task scheduling
- **Capabilities**: Can schedule tasks

### General
- **ID**: `general`
- **Description**: General assistance and questions
- **Tools**: Web search, general knowledge
- **Capabilities**: None specific

## Usage

### Setting Current Category

```typescript
import { categoryService } from "@kletron/server/services/categoryService";

// Set current category for user
await categoryService.setCurrentCategory(userId, "coding");

// Get current category
const current = await categoryService.getCurrentCategory(userId);
```

### Workspace-Specific Categories

```typescript
import { categoryService } from "@kletron/server/services/categoryService";

// Create custom workspace category
const custom = await categoryService.createWorkspaceCategory(
  workspaceId,
  "coding",
  {
    customName: "My Custom Coding",
    customTools: ["custom_tool_1", "custom_tool_2"]
  }
);

// Get workspace categories
const workspaceCats = await categoryService.getWorkspaceCategories(workspaceId);
```

### Running Category-Specific Workflows

```typescript
import { categoryWorkflowRunner } from "@kletron/agent-core/categoryWorkflowRunner";

// Run with specific category
const result = await categoryWorkflowRunner.runWithCategory(
  "Fix this bug",
  codingCategory,
  workspaceId
);

// Auto-detect category
const result = await categoryWorkflowRunner.runAutoCategory(
  "Write documentation",
  availableCategories,
  workspaceId
);
```

## API Endpoints

### GET /api/work-categories
Returns all available categories.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "coding",
      "name": "Code Assistance",
      "description": "AI-powered code analysis",
      "icon": "💻",
      "color": "#3B82F6",
      "defaultPrompt": "You are a senior software engineer...",
      "availableTools": ["list_files", "read_file", ...],
      "requiredContextTypes": ["repository"],
      "capabilities": {"canEditFiles": true}
    }
  ]
}
```

### GET /api/work-categories/workspace
Returns categories for the current workspace.

**Query Parameters**:
- `workspaceId` (optional) - Specific workspace ID

### POST /api/work-categories/workspace
Creates or updates a workspace-specific category.

**Body**:
```json
{
  "categoryId": "coding",
  "customName": "My Custom Coding",
  "customTools": ["tool1", "tool2"]
}
```

### POST /api/work-categories/current
Sets the current category for the user.

**Body**:
```json
{
  "categoryId": "drafting"
}
```

## Testing

Run tests with:
```bash
npm test -- packages/server/__tests__/categoryService.test.ts
npm test -- packages/agent-core/__tests__/categoryWorkflowRunner.test.ts
```

Run integration test script:
```bash
npx tsx scripts/test-category-system.ts
```

## Future Enhancements

1. **Category Templates**: Allow users to save and share category configurations
2. **Smart Category Switching**: Automatically switch categories based on context
3. **Category-Specific UI Themes**: Different color schemes for each category
4. **Advanced Recommendations**: Suggest categories based on user behavior patterns
