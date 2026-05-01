import path from "path";
import fs from "fs";

/**
 * Workspace-specific skills and connectors management
 */
class WorkspaceSkillsManager {
  constructor() {
    this.workspaceSkillsCache = new Map();
  }
  
  /**
   * Get skills configuration for a specific workspace
   */
  async getWorkspaceSkills(workspaceRoot) {
    const cacheKey = this.getCacheKey(workspaceRoot);
    
    // Return cached if available
    if (this.workspaceSkillsCache.has(cacheKey)) {
      return this.workspaceSkillsCache.get(cacheKey);
    }
    
    const skillsConfigPath = path.join(workspaceRoot, ".kletron", "skills.json");
    
    try {
      if (fs.existsSync(skillsConfigPath)) {
        const raw = fs.readFileSync(skillsConfigPath, "utf-8");
        const skillsConfig = JSON.parse(raw);
        
        this.workspaceSkillsCache.set(cacheKey, skillsConfig);
        return skillsConfig;
      }
    } catch (error) {
      console.warn(`[WorkspaceSkills] Failed to read skills config:`, error.message);
    }
    
    // Return empty config if not found
    const defaultConfig = this.getDefaultSkillsConfig();
    this.workspaceSkillsCache.set(cacheKey, defaultConfig);
    return defaultConfig;
  }
  
  /**
   * Get connectors configuration for a specific workspace
   */
  async getWorkspaceConnectors(workspaceRoot) {
    const cacheKey = this.getCacheKey(workspaceRoot);
    
    // Return cached if available
    if (this.workspaceSkillsCache.has(cacheKey)) {
      const cached = this.workspaceSkillsCache.get(cacheKey);
      return cached.connectors || [];
    }
    
    const connectorsConfigPath = path.join(workspaceRoot, ".kletron", "connectors.json");
    
    try {
      if (fs.existsSync(connectorsConfigPath)) {
        const raw = fs.readFileSync(connectorsConfigPath, "utf-8");
        return JSON.parse(raw);
      }
    } catch (error) {
      console.warn(`[WorkspaceSkills] Failed to read connectors config:`, error.message);
    }
    
    // Return empty array if not found
    return [];
  }
  
  /**
   * Get available skills for a workspace
   */
  async getAvailableSkills(workspaceRoot) {
    const skillsConfig = await this.getWorkspaceSkills(workspaceRoot);
    return skillsConfig.skills || [];
  }
  
  /**
   * Enable a skill for a workspace
   */
  async enableSkill(workspaceRoot, skillId) {
    const skillsConfig = await this.getWorkspaceSkills(workspaceRoot);
    
    if (!skillsConfig.skills) {
      skillsConfig.skills = [];
    }
    
    if (!skillsConfig.skills.includes(skillId)) {
      skillsConfig.skills.push(skillId);
      await this.saveSkillsConfig(workspaceRoot, skillsConfig);
      this.workspaceSkillsCache.delete(this.getCacheKey(workspaceRoot));
    }
  }
  
  /**
   * Disable a skill for a workspace
   */
  async disableSkill(workspaceRoot, skillId) {
    const skillsConfig = await this.getWorkspaceSkills(workspaceRoot);
    
    if (skillsConfig.skills && skillsConfig.skills.includes(skillId)) {
      skillsConfig.skills = skillsConfig.skills.filter(id => id !== skillId);
      await this.saveSkillsConfig(workspaceRoot, skillsConfig);
      this.workspaceSkillsCache.delete(this.getCacheKey(workspaceRoot));
    }
  }
  
  /**
   * Add a connector for a workspace
   */
  async addConnector(workspaceRoot, connectorConfig) {
    const connectors = await this.getWorkspaceConnectors(workspaceRoot);
    
    if (!Array.isArray(connectors)) {
      throw new Error("Invalid connectors configuration");
    }
    
    // Add new connector
    connectors.push(connectorConfig);
    
    const connectorsPath = path.join(workspaceRoot, ".kletron", "connectors.json");
    await this.ensureKletronDir(workspaceRoot);
    
    fs.writeFileSync(connectorsPath, JSON.stringify(connectors, null, 2), "utf-8");
    this.workspaceSkillsCache.delete(this.getCacheKey(workspaceRoot));
  }
  
  /**
   * Remove a connector from a workspace
   */
  async removeConnector(workspaceRoot, connectorId) {
    const connectors = await this.getWorkspaceConnectors(workspaceRoot);
    
    if (Array.isArray(connectors)) {
      const updatedConnectors = connectors.filter(conn => conn.id !== connectorId);
      
      const connectorsPath = path.join(workspaceRoot, ".kletron", "connectors.json");
      await this.ensureKletronDir(workspaceRoot);
      
      fs.writeFileSync(connectorsPath, JSON.stringify(updatedConnectors, null, 2), "utf-8");
      this.workspaceSkillsCache.delete(this.getCacheKey(workspaceRoot));
    }
  }
  
  /**
   * Get all available skills (global + workspace-specific)
   */
  async getAllAvailableSkills() {
    // Import global skills
    const { listSkills } = await import("./skillLoader.js");
    return listSkills();
  }
  
  /**
   * Get active tools for a workspace based on enabled skills and connectors
   */
   async getActiveToolsForWorkspace(workspaceRoot, categoryId) {
     const [skills, connectors] = await Promise.all([
       this.getAvailableSkills(workspaceRoot),
       this.getWorkspaceConnectors(workspaceRoot)
     ]);

     // Import all tools from the server
     const { buildAllTools } = await import("../server.js");
     let allTools;
     try {
       allTools = buildAllTools();
     } catch (error) {
       console.warn("[WorkspaceSkills] Could not load full tool set:", error.message);
       // Fallback to empty tools
       return {};
     }

     // Filter based on skills, connectors, and category
     return this.filterToolsBySkillsAndConnectors(allTools, skills, connectors, categoryId);
   }
  
  getCacheKey(workspaceRoot) {
    return path.normalize(workspaceRoot);
  }
  
  async saveSkillsConfig(workspaceRoot, config) {
    const skillsPath = path.join(workspaceRoot, ".kletron", "skills.json");
    await this.ensureKletronDir(workspaceRoot);
    fs.writeFileSync(skillsPath, JSON.stringify(config, null, 2), "utf-8");
  }
  
  async ensureKletronDir(workspaceRoot) {
    const kletronDir = path.join(workspaceRoot, ".kletron");
    if (!fs.existsSync(kletronDir)) {
      fs.mkdirSync(kletronDir, { recursive: true });
    }
  }
  
  getDefaultSkillsConfig() {
    return {
      skills: [],
      connectors: []
    };
  }
  
  filterToolsBySkillsAndConnectors(
    allTools,
    enabledSkills,
    connectors,
    categoryId
  ) {
    // Base coding tools are always available for coding category
    const baseTools = [
      "list_files", "read_file", "read_file_range", "search_code",
      "repo_metrics", "todo_search", "dependency_info", "describe_structure",
      "git_log", "git_diff", "git_grep", "git_blame", "structural_search",
      "symbols_list", "find_symbol", "go_to_definition", "references"
    ];

    const activeTools = {};

    // Add base tools for coding category or always if not specified
    if (!categoryId || categoryId === 'coding') {
      for (const toolName of baseTools) {
        if (allTools[toolName]) {
          activeTools[toolName] = allTools[toolName];
        }
      }
    }

    // Add skill-based tools based on category
    const skillBasedTools = {
      "web_search": enabledSkills.includes("research"),
      "fetch_url": enabledSkills.includes("research"),
      "github_api": enabledSkills.includes("github_integration"),
      "execute_bash": enabledSkills.includes("terminal_access") || categoryId === 'coding',
      "write_file": enabledSkills.includes("file_editing") || categoryId === 'drafting'
    };

    for (const [toolName, shouldInclude] of Object.entries(skillBasedTools)) {
      if (shouldInclude && allTools[toolName]) {
        activeTools[toolName] = allTools[toolName];
      }
    }

    // Add connector-based tools
    for (const connector of connectors) {
      if (connector.enabled && connector.tools) {
        for (const toolName of connector.tools) {
          if (allTools[toolName]) {
            activeTools[toolName] = allTools[toolName];
          }
        }
      }
    }

    return activeTools;
  }
}

// Export singleton instance
export const workspaceSkillsManager = new WorkspaceSkillsManager();