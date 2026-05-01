# Workspace-Specific Skills and Connectors Implementation

## Overview

This implementation adds workspace-specific skills and connectors management to Kletron, similar to Claude CoWork but focused on coding with extensible productivity features.

## Key Features

### 1. Workspace Isolation
- Each workspace has its own `.kletron/` directory for configuration
- Skills and connectors are scoped to individual workspaces
- Context is preserved per workspace/project
- Only reads files within the specified workspace

### 2. Skill Management
- **Global skills**: Available system-wide (research, github_integration, etc.)
- **Workspace-specific**: Enable/disable skills per workspace
- **Persistent configuration**: Stored in `.kletron/skills.json`

### 3. Connector System
- Add external service integrations (GitHub, Slack, Notion, etc.)
- Configure credentials and settings per workspace
- Connectors provide additional tools to the MCP server
- Stored in `.kletron/connectors.json`

### 4. Dynamic Tool Selection
- Tools available depend on enabled skills and connectors
- Base coding tools always available (file operations, git, etc.)
- Skill-specific tools added when skill is enabled
- Connector-provided tools added when connector is active

## Architecture

### Core Components

1. **WorkspaceSkillsManager** (`apps/mcp-server/tools/workspaceSkills.js`)
   - Manages skills and connectors per workspace
   - Handles caching for performance
   - Provides tool filtering based on enabled features

2. **MCP Server Integration** (`apps/mcp-server/server.js`)
   - `buildWorkspaceAwareTools()`: Returns tools specific to current workspace
   - `wireToolHandlers()`: Sets up MCP server with workspace-aware tools
   - New workspace management tools for MCP protocol

3. **Workspace Management Tools** (`apps/mcp-server/tools/workspaceTools.js`)
   - `listGlobalSkills`: List all available global skills
   - `listWorkspaceSkills`: List enabled skills for current workspace
   - `enableSkill`: Enable a skill for a workspace
   - `disableSkill`: Disable a skill for a workspace
   - `listConnectors`: List connectors for current workspace
   - `addConnector`: Add a new connector to workspace
   - `removeConnector`: Remove a connector from workspace
   - `getWorkspaceConfig`: Get complete workspace configuration

### Configuration Files

Each workspace gets:
- `.kletron/skills.json` - Enabled skills for this workspace
- `.kletron/connectors.json` - Configured connectors for this workspace

Example `skills.json`:
```json
{
  "skills": [
    "research",
    "github_integration"
  ],
  "connectors": []
}
```

## Usage Examples

### Enabling Skills via MCP

```javascript
// Enable research skill for current workspace
await enableSkill({ skillId: "research" });

// List enabled skills
const skills = await listWorkspaceSkills();
console.log(skills); // ["research", "github_integration"]
```

### Adding Connectors via MCP

```javascript
// Add GitHub connector
await addConnector({
  name: "GitHub Integration",
  type: "github",
  config: {
    token: "ghp_xxx",
    owner: "my-org"
  },
  tools: ["github_api"]
});

// List connectors
const connectors = await listConnectors();
```

### Getting Workspace Configuration

```javascript
const config = await getWorkspaceConfig();
console.log(config);
/* {
   workspacePath: "/path/to/workspace",
   skills: ["research", "github_integration"],
   connectors: [{ id: "github_xxx", ... }]
 } */
```

## Integration with Code Editor

The implementation maintains full compatibility with the existing code editor:
- All base coding tools remain available
- Workspace-specific features are additive
- Context is properly scoped to workspace
- File operations only access files within workspace

### Example Workflow

1. User opens a project in Kletron
2. System detects `.kletron/` directory (if exists)
3. Loads workspace-specific skills and connectors
4. Provides appropriate tools based on configuration
5. All file operations limited to workspace directory
6. Context preserved when switching between workspaces

## Security Considerations

- Connectors store credentials in workspace-specific files
- No global access to connector credentials
- Skills can be selectively enabled/disabled per workspace
- File system access restricted to workspace root

## Testing

Run the test suite:
```bash
node test-workspace-skills.js
```

Run the demonstration:
```bash
node demo-workspace-integration.js
```

## Future Enhancements

1. **Skill Templates**: Pre-configured skill sets for different project types
2. **Automatic Skill Detection**: Suggest skills based on project structure
3. **Collaboration Features**: Share workspace configurations with team members
4. **Conditional Connectors**: Connectors that activate only when certain files are present
5. **Skill Marketplace**: Discover and install new skills from a registry

## Migration Path

Existing projects will automatically work:
- If no `.kletron/` directory exists, all tools are available (backward compatible)
- Users can gradually adopt workspace-specific features
- No breaking changes to existing functionality
