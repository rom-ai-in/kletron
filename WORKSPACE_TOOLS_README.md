# Workspace Management Tools

These MCP tools allow management of workspace-specific skills and connectors.

## Available Tools

### Skill Management

#### `list_global_skills`
List all available global skills that can be enabled for workspaces.

**Input:** None

**Output:** Array of skill objects with id, name, and description

```json
[
  {
    "id": "research",
    "name": "Research",
    "description": "Web search and research capabilities"
  }
]
```

#### `list_workspace_skills`
List skills currently enabled for the active workspace.

**Input:**
```json
{
  "workspacePath": "optional/path/to/workspace"
}
```

**Output:** Array of enabled skill IDs

```json
["research", "github_integration"]
```

#### `enable_skill`
Enable a skill for the active workspace.

**Input:**
```json
{
  "skillId": "research",
  "workspacePath": "optional/path/to/workspace"
}
```

**Output:** Success confirmation

```json
{
  "success": true,
  "message": "Skill research enabled for workspace"
}
```

#### `disable_skill`
Disable a skill for the active workspace.

**Input:**
```json
{
  "skillId": "research",
  "workspacePath": "optional/path/to/workspace"
}
```

**Output:** Success confirmation

```json
{
  "success": true,
  "message": "Skill research disabled for workspace"
}
```

### Connector Management

#### `list_connectors`
List all connectors configured for the active workspace.

**Input:**
```json
{
  "workspacePath": "optional/path/to/workspace"
}
```

**Output:** Array of connector objects

```json
[
  {
    "id": "github_demo",
    "name": "GitHub Demo Connector",
    "type": "github",
    "config": {
      "token": "demo-token",
      "owner": "demo-org"
    },
    "tools": ["github_api"],
    "enabled": true
  }
]
```

#### `add_connector`
Add a new connector to the active workspace.

**Input:**
```json
{
  "name": "GitHub Integration",
  "type": "github",
  "config": {
    "token": "ghp_xxx",
    "owner": "my-org"
  },
  "tools": ["github_api"],
  "workspacePath": "optional/path/to/workspace"
}
```

**Output:** Success with connector ID

```json
{
  "success": true,
  "connectorId": "github_1234567890"
}
```

#### `remove_connector`
Remove a connector from the active workspace.

**Input:**
```json
{
  "connectorId": "github_1234567890",
  "workspacePath": "optional/path/to/workspace"
}
```

**Output:** Success confirmation

```json
{
  "success": true,
  "message": "Connector github_1234567890 removed"
}
```

### Workspace Configuration

#### `get_workspace_config`
Get the complete configuration for the active workspace including enabled skills and connectors.

**Input:**
```json
{
  "workspacePath": "optional/path/to/workspace"
}
```

**Output:** Complete workspace configuration

```json
{
  "workspacePath": "/path/to/workspace",
  "skills": ["research", "github_integration"],
  "connectors": [
    {
      "id": "github_demo",
      "name": "GitHub Demo Connector",
      "type": "github",
      "config": {"token": "demo-token", "owner": "demo-org"},
      "tools": ["github_api"],
      "enabled": true
    }
  ]
}
```

## Usage Examples

### Enable Research Skill

```javascript
// Via MCP protocol
const result = await callTool("enable_skill", {
  skillId: "research"
});
console.log(result.message); // "Skill research enabled for workspace"
```

### Add GitHub Connector

```javascript
// Via MCP protocol
const connectorResult = await callTool("add_connector", {
  name: "GitHub Integration",
  type: "github",
  config: {
    token: process.env.GITHUB_TOKEN,
    owner: "my-org"
  },
  tools: ["github_api"]
});

console.log("Connector added:", connectorResult.connectorId);
```

### Get Current Workspace Configuration

```javascript
// Via MCP protocol
const config = await callTool("get_workspace_config", {});
console.log("Skills:", config.skills);
console.log("Connectors:", config.connectors.length);
```

## Best Practices

1. **Use workspacePath parameter** when working with multiple workspaces simultaneously
2. **Store credentials securely** in connector configurations
3. **Enable only needed skills** to keep the tool set focused
4. **Review connector tools** before adding connectors to understand what access they provide
5. **Test new configurations** in a safe workspace before applying to production projects
