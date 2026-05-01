#!/usr/bin/env node

/**
 * Test script for workspace-specific skills and connectors functionality
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add the project root to module resolution
const projectRoot = path.resolve(__dirname, "..", "..");
process.chdir(projectRoot);

async function testWorkspaceSkills() {
  console.log("🧪 Testing Workspace-Specific Skills and Connectors\n");
  
  try {
    // Import the workspace skills manager
    const { workspaceSkillsManager } = await import("./apps/mcp-server/tools/workspaceSkills.js");
    
    // Create test workspace directory
    const testWorkspace = path.join(projectRoot, "test-workspace");
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true });
    }
    
    console.log("✅ Test workspace created:", testWorkspace);
    
    // Test 1: Get skills for empty workspace
    console.log("\n📋 Test 1: Get skills for empty workspace");
    const initialSkills = await workspaceSkillsManager.getAvailableSkills(testWorkspace);
    console.log("Initial skills:", initialSkills);
    
    // Test 2: Enable a skill
    console.log("\n📋 Test 2: Enable 'research' skill");
    await workspaceSkillsManager.enableSkill(testWorkspace, "research");
    const enabledSkills = await workspaceSkillsManager.getAvailableSkills(testWorkspace);
    console.log("Enabled skills:", enabledSkills);
    
    // Test 3: Disable the skill
    console.log("\n📋 Test 3: Disable 'research' skill");
    await workspaceSkillsManager.disableSkill(testWorkspace, "research");
    const disabledSkills = await workspaceSkillsManager.getAvailableSkills(testWorkspace);
    console.log("Disabled skills:", disabledSkills);
    
    // Test 4: Add a connector
    console.log("\n📋 Test 4: Add GitHub connector");
    const githubConnector = {
      id: "github_test",
      name: "GitHub Integration",
      type: "github",
      config: {
        token: "fake-token-for-testing",
        owner: "test-owner"
      },
      tools: ["github_api"],
      enabled: true
    };
    
    await workspaceSkillsManager.addConnector(testWorkspace, githubConnector);
    const connectors = await workspaceSkillsManager.getWorkspaceConnectors(testWorkspace);
    console.log("Connectors:", connectors);
    
    // Test 5: Remove connector
    console.log("\n📋 Test 5: Remove GitHub connector");
    await workspaceSkillsManager.removeConnector(testWorkspace, "github_test");
    const remainingConnectors = await workspaceSkillsManager.getWorkspaceConnectors(testWorkspace);
    console.log("Remaining connectors:", remainingConnectors);
    
    // Test 6: Get all available global skills
    console.log("\n📋 Test 6: Get all available global skills");
    const allSkills = await workspaceSkillsManager.getAllAvailableSkills();
    console.log("Global skills count:", allSkills.length);
    
    // Cleanup
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
      console.log("\n🧹 Test workspace cleaned up");
    }
    
    console.log("\n✅ All tests passed!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  await testWorkspaceSkills();
}

export { testWorkspaceSkills };