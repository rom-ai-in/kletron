import { workspaceSkillsManager } from "./workspaceSkills.js";

/**
 * List available global skills
 */
export const listGlobalSkills = {
  description: "List all available global skills that can be enabled for workspaces",
  inputSchema: {
    type: "object",
    properties: {}
  },
  async run() {
    return await workspaceSkillsManager.getAllAvailableSkills();
  }
};

/**
 * List skills enabled for current workspace
 */
export const listWorkspaceSkills = {
  description: "List skills currently enabled for the active workspace",
  inputSchema: {
    type: "object",
    properties: {
      workspacePath: {
        type: "string",
        description: "Optional path to workspace. Uses default if not provided."
      }
    }
  },
  async run({ workspacePath }) {
    const targetWorkspace = workspacePath || (await import("../config.js")).config.defaultDir;
    
    if (!targetWorkspace) {
      throw new Error("No active workspace configured");
    }
    
    return await workspaceSkillsManager.getAvailableSkills(targetWorkspace);
  }
};

/**
 * Enable a skill for the current workspace
 */
export const enableSkill = {
  description: "Enable a skill for the active workspace",
  inputSchema: {
    type: "object",
    properties: {
      skillId: {
        type: "string",
        description: "ID of the skill to enable"
      },
      workspacePath: {
        type: "string",
        description: "Optional path to workspace. Uses default if not provided."
      }
    },
    required: ["skillId"]
  },
  async run({ skillId, workspacePath }) {
    const targetWorkspace = workspacePath || (await import("../config.js")).config.defaultDir;
    
    if (!targetWorkspace) {
      throw new Error("No active workspace configured");
    }
    
    await workspaceSkillsManager.enableSkill(targetWorkspace, skillId);
    return { success: true, message: `Skill ${skillId} enabled for workspace` };
  }
};

/**
 * Disable a skill for the current workspace
 */
export const disableSkill = {
  description: "Disable a skill for the active workspace",
  inputSchema: {
    type: "object",
    properties: {
      skillId: {
        type: "string",
        description: "ID of the skill to disable"
      },
      workspacePath: {
        type: "string",
        description: "Optional path to workspace. Uses default if not provided."
      }
    },
    required: ["skillId"]
  },
  async run({ skillId, workspacePath }) {
    const targetWorkspace = workspacePath || (await import("../config.js")).config.defaultDir;
    
    if (!targetWorkspace) {
      throw new Error("No active workspace configured");
    }
    
    await workspaceSkillsManager.disableSkill(targetWorkspace, skillId);
    return { success: true, message: `Skill ${skillId} disabled for workspace` };
  }
};

/**
 * List connectors configured for current workspace
 */
export const listConnectors = {
  description: "List all connectors configured for the active workspace",
  inputSchema: {
    type: "object",
    properties: {
      workspacePath: {
        type: "string",
        description: "Optional path to workspace. Uses default if not provided."
      }
    }
  },
  async run({ workspacePath }) {
    const targetWorkspace = workspacePath || (await import("../config.js")).config.defaultDir;
    
    if (!targetWorkspace) {
      throw new Error("No active workspace configured");
    }
    
    return await workspaceSkillsManager.getWorkspaceConnectors(targetWorkspace);
  }
};

/**
 * Add a connector to the current workspace
 */
export const addConnector = {
  description: "Add a new connector to the active workspace",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the connector"
      },
      type: {
        type: "string",
        description: "Type of connector (e.g., 'github', 'slack', 'notion')"
      },
      config: {
        type: "object",
        description: "Configuration for the connector"
      },
      tools: {
        type: "array",
        items: { type: "string" },
        description: "List of tool names this connector provides"
      },
      workspacePath: {
        type: "string",
        description: "Optional path to workspace. Uses default if not provided."
      }
    },
    required: ["name", "type", "config"]
  },
  async run({ name, type, config, tools = [], workspacePath }) {
    const targetWorkspace = workspacePath || (await import("../config.js")).config.defaultDir;
    
    if (!targetWorkspace) {
      throw new Error("No active workspace configured");
    }
    
    const connectorId = `${type}_${Date.now()}`;
    await workspaceSkillsManager.addConnector(targetWorkspace, {
      id: connectorId,
      name,
      type,
      config,
      tools,
      enabled: true
    });
    
    return { success: true, connectorId };
  }
};

/**
 * Remove a connector from the current workspace
 */
export const removeConnector = {
  description: "Remove a connector from the active workspace",
  inputSchema: {
    type: "object",
    properties: {
      connectorId: {
        type: "string",
        description: "ID of the connector to remove"
      },
      workspacePath: {
        type: "string",
        description: "Optional path to workspace. Uses default if not provided."
      }
    },
    required: ["connectorId"]
  },
  async run({ connectorId, workspacePath }) {
    const targetWorkspace = workspacePath || (await import("../config.js")).config.defaultDir;
    
    if (!targetWorkspace) {
      throw new Error("No active workspace configured");
    }
    
    await workspaceSkillsManager.removeConnector(targetWorkspace, connectorId);
    return { success: true, message: `Connector ${connectorId} removed` };
  }
};

/**
 * Get current workspace configuration including skills and connectors
 */
export const getWorkspaceConfig = {
  description: "Get the complete configuration for the active workspace",
  inputSchema: {
    type: "object",
    properties: {
      workspacePath: {
        type: "string",
        description: "Optional path to workspace. Uses default if not provided."
      }
    }
  },
  async run({ workspacePath }) {
    const targetWorkspace = workspacePath || (await import("../config.js")).config.defaultDir;
    
    if (!targetWorkspace) {
      throw new Error("No active workspace configured");
    }
    
    const [skills, connectors] = await Promise.all([
      workspaceSkillsManager.getAvailableSkills(targetWorkspace),
      workspaceSkillsManager.getWorkspaceConnectors(targetWorkspace)
    ]);
    
    return {
      workspacePath: targetWorkspace,
      skills,
      connectors
    };
  }
};