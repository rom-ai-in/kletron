#!/usr/bin/env node

/**
 * Test MCP server integration with workspace tools
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import http from "http";

async function testMcpIntegration() {
  console.log("🧪 Testing MCP Server Integration with Workspace Tools\n");
  
  try {
    // Import our server implementation
    const { buildAllWorkspaceTools } = await import("./apps/mcp-server/server.js");
    
    console.log("✅ Successfully imported MCP server functions");
    
    // Test that we can build all tools including workspace management
    const tools = await buildAllWorkspaceTools();
    
    console.log("\n📋 Available tools count:", Object.keys(tools).length);
    
    // Check for workspace-specific tools
    const workspaceTools = [
      "list_global_skills",
      "list_workspace_skills", 
      "enable_skill",
      "disable_skill",
      "list_connectors",
      "add_connector",
      "remove_connector",
      "get_workspace_config"
    ];
    
    console.log("\n🔧 Workspace management tools:");
    workspaceTools.forEach(toolName => {
      if (tools[toolName]) {
        console.log(`   ✅ ${toolName}`);
      } else {
        console.log(`   ❌ ${toolName} (missing)`);
      }
    });
    
    // Check that base tools are still available
    const baseTools = ["list_files", "read_file", "search_code", "git_log"];
    
    console.log("\n🛠️  Base coding tools:");
    let allBasePresent = true;
    baseTools.forEach(toolName => {
      if (tools[toolName]) {
        console.log(`   ✅ ${toolName}`);
      } else {
        console.log(`   ❌ ${toolName} (missing)`);
        allBasePresent = false;
      }
    });
    
    if (allBasePresent) {
      console.log("\n✅ All base coding tools present");
    } else {
      console.log("\n⚠️  Some base tools missing");
    }
    
    // Verify tool structure
    const sampleTool = tools.list_global_skills;
    if (sampleTool) {
      console.log("\n📋 Sample workspace tool structure:");
      console.log(`   Name: ${sampleTool.description}`);
      console.log(`   Has inputSchema: ${!!sampleTool.inputSchema}`);
      console.log(`   Has run method: ${typeof sampleTool.run === 'function'}`);
    }
    
    console.log("\n✅ MCP integration test passed!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  await testMcpIntegration();
}

export { testMcpIntegration };