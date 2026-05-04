#!/usr/bin/env node

/**
 * Demonstration of workspace-specific skills integration
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add the project root to module resolution
const projectRoot = path.resolve(__dirname, "..", "..");
process.chdir(projectRoot);

async function demonstrateWorkspaceIntegration() {
  console.log("🚀 Demonstrating Workspace-Specific Skills Integration\n");
  
  try {
    // Import the workspace skills manager
    const { workspaceSkillsManager } = await import("./apps/mcp-server/tools/workspaceSkills.js");
    
    // Create a demo project structure
    const demoWorkspace = path.join(projectRoot, "demo-project");
    if (!fs.existsSync(demoWorkspace)) {
      fs.mkdirSync(demoWorkspace, { recursive: true });
    }
    
    console.log("📁 Created demo workspace:", demoWorkspace);
    
    // Create a simple project file
    const packageJson = {
      name: "demo-project",
      version: "1.0.0",
      description: "Demo project for Kletron workspace skills"
    };
    
    fs.writeFileSync(
      path.join(demoWorkspace, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );
    
    console.log("✅ Created package.json");
    
    // Enable skills for this workspace
    console.log("\n🔧 Configuring workspace skills...");
    await workspaceSkillsManager.enableSkill(demoWorkspace, "research");
    await workspaceSkillsManager.enableSkill(demoWorkspace, "github_integration");
    
    const enabledSkills = await workspaceSkillsManager.getAvailableSkills(demoWorkspace);
    console.log("✅ Enabled skills:", enabledSkills.join(", "));
    
    // Add a GitHub connector
    console.log("\n🔗 Adding GitHub connector...");
    await workspaceSkillsManager.addConnector(demoWorkspace, {
      id: "github_demo",
      name: "GitHub Demo Connector",
      type: "github",
      config: {
        token: "demo-token",
        owner: "demo-org"
      },
      tools: ["github_api"],
      enabled: true
    });
    
    const connectors = await workspaceSkillsManager.getWorkspaceConnectors(demoWorkspace);
    console.log("✅ Added connector:", connectors[0].name);
    
    // Show available tools for this workspace
    console.log("\n🛠️  Available tools for this workspace:");
    const allTools = await import("./apps/mcp-server/server.js");
    const workspaceTools = await workspaceSkillsManager.getActiveToolsForWorkspace(demoWorkspace);
    
    console.log("   Base coding tools:", Object.keys(workspaceTools).filter(t => 
      ["list_files", "read_file", "search_code", "git_log"].includes(t)
    ).join(", "));
    
    if (enabledSkills.includes("research")) {
      console.log("   Research tools:", Object.keys(workspaceTools).filter(t => 
        ["web_search", "fetch_url"].includes(t)
      ).join(", "));
    }
    
    if (connectors.length > 0) {
      console.log("   Connector tools:", connectors[0].tools.join(", "));
    }
    
    // Show the .kletron directory structure
    console.log("\n📂 Workspace configuration files:");
    const kletronDir = path.join(demoWorkspace, ".kletron");
    if (fs.existsSync(kletronDir)) {
      const files = fs.readdirSync(kletronDir);
      files.forEach(file => {
        console.log(`   ${file}`);
      });
    }
    
    // Show sample content
    console.log("\n📄 Sample skills.json content:");
    const skillsContent = fs.readFileSync(
      path.join(kletronDir, "skills.json"),
      "utf-8"
    );
    console.log(skillsContent);
    
    // Cleanup
    if (fs.existsSync(demoWorkspace)) {
      fs.rmSync(demoWorkspace, { recursive: true, force: true });
      console.log("\n🧹 Demo workspace cleaned up");
    }
    
    console.log("\n✅ Demonstration complete!");
    console.log("\n💡 Key Features Demonstrated:");
    console.log("   • Workspace-specific skill configuration");
    console.log("   • Connector management per workspace");
    console.log("   • Dynamic tool availability based on skills");
    console.log("   • Persistent configuration in .kletron directory");
    console.log("   • Integration with existing code editor tools");
    
  } catch (error) {
    console.error("\n❌ Demonstration failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  await demonstrateWorkspaceIntegration();
}

export { demonstrateWorkspaceIntegration };